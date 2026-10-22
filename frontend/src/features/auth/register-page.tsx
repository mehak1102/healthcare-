import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordField } from '@/components/ui/password-field';
import { ApiError } from '@/lib/api-client';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthShell } from './auth-shell';
import { authPath, portalFromSearch } from './home-for-roles';
import { PortalChoice, type AccountPortal } from './portal-choice';
import { PASSWORD_MIN, registerSchema, type RegisterValues } from './schemas';
import { useRegister } from './use-auth';

const ACCOUNT_TYPES = ['patient', 'doctor'] as const;

export function RegisterPage() {
  usePageTitle('Create account');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const registration = useRegister();
  const [accountType, setAccountType] = useState<AccountPortal>(portalFromSearch(params.get('as')));
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: '',
      email: params.get('email')?.trim() ?? '',
      password: '',
      acceptTerms: false,
      accountType,
    },
  });

  const onSubmit = handleSubmit((values) =>
    registration.mutate(
      { ...values, acceptTerms: true, accountType },
      {
        onSuccess: () => {
          const next = params.get('next');
          navigate(
            next ? safeRedirectPath(next) : accountType === 'doctor' ? '/doctor' : '/patient',
            { replace: true },
          );
        },
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'EMAIL_TAKEN') {
            setError('email', {
              message: 'An account with this email already exists. Try signing in instead.',
            });
          }
        },
      },
    ),
  );

  const serverError =
    registration.error instanceof ApiError && registration.error.code !== 'EMAIL_TAKEN'
      ? registration.error
      : null;

  return (
    <AuthShell
      wide
      title={accountType === 'doctor' ? 'Create a doctor account' : 'Create a patient account'}
      description={
        accountType === 'doctor'
          ? 'You can complete your profile after this. An administrator still has to verify you before patients can book you.'
          : 'It takes a minute. You stay in control of your data.'
      }
      footer={
        <>
          Already have an account?{' '}
          <Link
            to={authPath('/login', accountType, params.get('next'))}
            className="font-semibold text-coral-ink hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <PortalChoice
          value={accountType}
          onChange={setAccountType}
          legend="Create account as"
          options={ACCOUNT_TYPES}
        />
        {serverError && (
          <Alert tone="error" title="We could not create your account">
            {serverError.details.length > 0 ? serverError.details.join('. ') : serverError.message}
          </Alert>
        )}
        <FormField
          label="Full name"
          autoComplete="name"
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <PasswordField
          label="Password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters. A memorable phrase like "quiet river morning tea" works well.`}
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="flex flex-col gap-1.5">
          <label className="flex items-start gap-3 text-sm leading-relaxed text-ink">
            <input
              type="checkbox"
              className="mt-1 size-4 shrink-0 accent-coral-ink"
              aria-invalid={errors.acceptTerms ? true : undefined}
              aria-describedby={errors.acceptTerms ? 'accept-terms-error' : undefined}
              {...register('acceptTerms')}
            />
            <span>
              I agree to the{' '}
              <Link
                to="/terms"
                target="_blank"
                className="font-semibold text-coral-ink underline-offset-2 hover:underline"
              >
                Terms of Use
              </Link>{' '}
              and have read the{' '}
              <Link
                to="/privacy"
                target="_blank"
                className="font-semibold text-coral-ink underline-offset-2 hover:underline"
              >
                Privacy Notice
              </Link>
              .
            </span>
          </label>
          {errors.acceptTerms && (
            <p id="accept-terms-error" className="text-sm font-medium text-danger-ink">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>
        <Button type="submit" size="lg" loading={registration.isPending} className="mt-1 w-full">
          Create account
        </Button>
      </form>
    </AuthShell>
  );
}
