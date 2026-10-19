import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { MailCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { authApi } from './api';
import { AuthShell } from './auth-shell';
import { forgotPasswordSchema, type ForgotPasswordValues } from './schemas';

export function ForgotPasswordPage() {
  usePageTitle('Reset your password');
  const request = useMutation({ mutationFn: authApi.requestPasswordReset });
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(({ email }) => request.mutate(email));
  const footer = (
    <Link to="/login" className="font-semibold text-coral-ink hover:underline">
      Back to sign in
    </Link>
  );

  if (request.isSuccess) {
    return (
      <AuthShell
        title="Check your email"
        description="One more step to get back in."
        footer={footer}
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success-surface text-success-ink">
            <MailCheck className="size-6" aria-hidden="true" />
          </span>
          <p role="status" className="leading-relaxed">
            If an account exists for <strong className="break-all">{getValues('email')}</strong>, we
            have sent a link to reset your password. It works once and expires in 30 minutes.
          </p>
          <p className="text-sm text-ink-muted">
            Nothing arrived? Check your spam folder, or wait a minute and try again.
          </p>
          <Button variant="secondary" onClick={() => request.reset()}>
            Use a different email
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Forgot your password?"
      description="Enter the email you signed up with and we will send you a reset link."
      footer={footer}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {request.isError && (
          <Alert tone="error">
            {request.error instanceof ApiError
              ? request.error.message
              : 'Something went wrong. Please try again.'}
          </Alert>
        )}
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" size="lg" loading={request.isPending} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthShell>
  );
}
