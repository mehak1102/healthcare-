import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, LoaderCircle } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button-variants';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { authApi } from './api';
import { AuthShell } from './auth-shell';
import { CURRENT_USER_KEY, useCurrentUser } from './use-auth';
import { useLinkToken } from './use-link-token';

export function VerifyEmailPage() {
  usePageTitle('Verify your email');
  const token = useLinkToken();
  const queryClient = useQueryClient();
  const { data: user } = useCurrentUser();
  const confirm = useMutation({
    mutationFn: authApi.confirmEmailVerification,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY }),
  });

  const started = useRef(false);
  const { mutate } = confirm;
  useEffect(() => {
    // Links are single-use, so never submit twice (React StrictMode re-runs effects in development).
    if (!token || started.current) return;
    started.current = true;
    mutate(token);
  }, [token, mutate]);

  const next = user
    ? { to: '/account', label: 'Go to your account' }
    : { to: '/login', label: 'Sign in' };
  const footer = (
    <Link to="/" className="font-semibold text-coral-ink hover:underline">
      Back to home
    </Link>
  );

  if (confirm.isSuccess) {
    return (
      <AuthShell title="Email verified" description="Thank you for confirming." footer={footer}>
        <div className="flex flex-col items-center gap-5 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-success-surface text-success-ink">
            <CheckCircle2 className="size-6" aria-hidden="true" />
          </span>
          <p role="status">Your email address is confirmed.</p>
          <Link to={next.to} className={buttonVariants()}>
            {next.label}
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (!token || confirm.isError) {
    const message =
      !token ||
      (confirm.error instanceof ApiError && confirm.error.code === 'INVALID_OR_EXPIRED_LINK')
        ? 'This link is invalid, has expired, or was already used.'
        : confirm.error instanceof ApiError
          ? confirm.error.message
          : 'Something went wrong. Please try again.';
    return (
      <AuthShell
        title="We could not verify your email"
        description="No changes were made."
        footer={footer}
      >
        <div className="flex flex-col gap-5">
          <Alert tone="error">{message}</Alert>
          <p className="text-sm text-ink-muted">
            You can send a fresh link from your account page. Links expire after 24 hours.
          </p>
          <Link to="/account" className={buttonVariants({ variant: 'secondary' })}>
            {user ? 'Go to your account' : 'Sign in to send a new link'}
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Verifying your email" description="This only takes a moment." footer={footer}>
      <p role="status" className="flex items-center justify-center gap-2 text-ink-muted">
        <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        Confirming your email address…
      </p>
    </AuthShell>
  );
}
