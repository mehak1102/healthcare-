import { useMutation } from '@tanstack/react-query';
import { MailWarning } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { authApi } from '@/features/auth/api';
import { ApiError } from '@/lib/api-client';

export function VerifyEmailNotice({ email }: { email: string }) {
  const send = useMutation({ mutationFn: authApi.requestEmailVerification });

  if (send.isSuccess) {
    return (
      <Alert tone="success" className="mt-5">
        We have sent a verification link to <strong className="break-all">{email}</strong>. It
        expires in 24 hours. Sending another link cancels the previous one.
      </Alert>
    );
  }

  return (
    <Alert tone="warning" className="mt-5">
      <span className="inline-flex items-start gap-2">
        <MailWarning className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        Please verify your email address. You will need to before your first booking.
      </span>
      {send.isError && (
        <p className="mt-2 font-semibold">
          {send.error instanceof ApiError
            ? send.error.message
            : 'Something went wrong. Please try again.'}
        </p>
      )}
      <Button
        size="sm"
        variant="secondary"
        loading={send.isPending}
        onClick={() => send.mutate()}
        className="mt-3"
      >
        Send verification email
      </Button>
    </Alert>
  );
}
