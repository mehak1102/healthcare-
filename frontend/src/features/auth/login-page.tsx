import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { PasswordField } from '@/components/ui/password-field';
import { ApiError } from '@/lib/api-client';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { usePageTitle } from '@/lib/use-page-title';
import { AuthShell } from './auth-shell';
import { MfaChallengeForm } from './mfa-challenge-form';
import { authPath, loginPortalFromSearch } from './home-for-roles';
import { PortalChoice, type LoginPortal } from './portal-choice';
import type { LoginNotice } from './reset-password-page';
import { loginSchema, type LoginValues } from './schemas';
import { useLogin } from './use-auth';

function loginErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.code === 'NETWORK_ERROR' || error.status === 0 || error.status >= 502) {
    return 'Cannot reach the server. Start the API in another terminal: cd backend && npm run dev';
  }
  if (error.code === 'INVALID_CREDENTIALS') {
    return 'That email and password combination did not work. After several failed attempts, sign-in is paused for 15 minutes.';
  }
  return error.message;
}

const LOGIN_PORTALS = ['patient', 'doctor', 'staff'] as const;
const HOME_FOR_PORTAL: Record<LoginPortal, string> = {
  patient: '/patient',
  doctor: '/doctor',
  staff: '/account',
};

export function LoginPage() {
  usePageTitle('Sign in');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const notice = useLocation().state as LoginNotice | null;
  const login = useLogin();
  const [portal, setPortal] = useState<LoginPortal>(loginPortalFromSearch(params.get('as')));
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', portal },
  });

  const goToNext = () => {
    const next = params.get('next');
    navigate(next ? safeRedirectPath(next) : HOME_FOR_PORTAL[portal], { replace: true });
  };
  const onSubmit = handleSubmit((values) =>
    login.mutate(
      { ...values, portal },
      { onSuccess: (signedIn) => (signedIn ? goToNext() : undefined) },
    ),
  );

  if (login.data === false) {
    return (
      <AuthShell
        title="Two-step verification"
        description="One more step to keep your account safe."
        footer="Lost your phone and your recovery codes? Contact support to restore access."
      >
        <MfaChallengeForm onSignedIn={goToNext} onStartOver={() => login.reset()} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      wide
      title="Welcome back"
      description="Choose how you are signing in. Your role comes from your account, not from this choice."
      footer={
        portal === 'staff' ? (
          'Staff accounts are created by an administrator. They cannot be registered here.'
        ) : (
          <>
            New to Sukoon?{' '}
            <Link
              to={authPath('/register', portal, params.get('next'))}
              className="font-semibold text-coral-ink hover:underline"
            >
              Create an account
            </Link>
          </>
        )
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <PortalChoice
          value={portal}
          onChange={setPortal}
          legend="Sign in as"
          options={LOGIN_PORTALS}
        />
        {notice?.passwordReset && !login.isError && (
          <Alert tone="success">
            Your password has been reset and every device was signed out. Sign in with your new
            password.
          </Alert>
        )}
        {notice?.accountDeleted && !login.isError && (
          <Alert tone="success">
            Your account has been deleted and you have been signed out everywhere. You can create a
            new account at any time.
          </Alert>
        )}
        {login.isError && <Alert tone="error">{loginErrorMessage(login.error)}</Alert>}
        <FormField
          label="Email address"
          type="email"
          autoComplete="email"
          inputMode="email"
          error={errors.email?.message}
          {...register('email')}
        />
        <div className="flex flex-col gap-2">
          <PasswordField
            label="Password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />
          <Link
            to="/forgot-password"
            className="self-end text-sm font-semibold text-coral-ink hover:underline"
          >
            Forgot your password?
          </Link>
        </div>
        <Button type="submit" size="lg" loading={login.isPending} className="mt-1 w-full">
          Sign in
        </Button>
      </form>
    </AuthShell>
  );
}
