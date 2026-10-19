import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { PasswordField } from '@/components/ui/password-field';
import { ApiError, setCsrfToken } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import { authApi } from './api';
import { AuthShell } from './auth-shell';
import { PASSWORD_MIN, resetPasswordSchema, type ResetPasswordValues } from './schemas';
import { CURRENT_USER_KEY } from './use-auth';
import { useLinkToken } from './use-link-token';

export interface LoginNotice {
  passwordReset?: boolean;
  accountDeleted?: boolean;
}

const requestNewLink = (
  <Link to="/forgot-password" className="font-semibold underline">
    Request a new link
  </Link>
);

function resetErrorMessage(error: unknown) {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  if (error.code === 'INVALID_OR_EXPIRED_LINK') {
    return (
      <>
        {error.message} {requestNewLink}
      </>
    );
  }
  return error.details.length ? error.details.join('. ') : error.message;
}

export function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const token = useLinkToken();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const reset = useMutation({
    mutationFn: authApi.confirmPasswordReset,
    onSuccess: () => {
      // The server signed this account out everywhere, including this browser.
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
      const notice: LoginNotice = { passwordReset: true };
      void navigate('/login', { replace: true, state: notice });
    },
  });

  const onSubmit = handleSubmit(({ newPassword }) => {
    if (token) reset.mutate({ token, newPassword });
  });
  const footer = (
    <Link to="/login" className="font-semibold text-coral-ink hover:underline">
      Back to sign in
    </Link>
  );

  if (!token) {
    return (
      <AuthShell
        title="Link incomplete"
        description="We could not read your reset link."
        footer={footer}
      >
        <Alert tone="error">
          Open the link from your email again, making sure the whole link was copied.{' '}
          {requestNewLink}
        </Alert>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Choose a new password"
      description="Once saved, you will be signed out on every device and can sign in again."
      footer={footer}
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {reset.isError && <Alert tone="error">{resetErrorMessage(reset.error)}</Alert>}
        <PasswordField
          label="New password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN} characters. A short phrase works well.`}
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <PasswordField
          label="Confirm new password"
          autoComplete="new-password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" size="lg" loading={reset.isPending} className="w-full">
          Save new password
        </Button>
      </form>
    </AuthShell>
  );
}
