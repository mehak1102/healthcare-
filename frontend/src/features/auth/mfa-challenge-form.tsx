import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { ApiError } from '@/lib/api-client';
import { authenticatorCodeSchema, recoveryCodeSchema } from './schemas';
import { useMfaChallenge } from './use-auth';

const SIGN_IN_ENDED = new Set(['MFA_CHALLENGE_EXPIRED', 'MFA_LOCKED']);

interface MfaChallengeFormProps {
  onSignedIn: () => void;
  onStartOver: () => void;
}

export function MfaChallengeForm({ onSignedIn, onStartOver }: MfaChallengeFormProps) {
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const challenge = useMfaChallenge();
  const schema = z.object({ code: useRecoveryCode ? recoveryCodeSchema : authenticatorCodeSchema });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof schema>, unknown, z.output<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: { code: '' },
  });

  const error = challenge.error instanceof ApiError ? challenge.error : null;
  const ended = error !== null && SIGN_IN_ENDED.has(error.code);
  const onSubmit = handleSubmit(({ code }) => challenge.mutate(code, { onSuccess: onSignedIn }));

  if (ended) {
    return (
      <div className="flex flex-col gap-5">
        <Alert tone="error">{error.message}</Alert>
        <Button size="lg" className="w-full" onClick={onStartOver}>
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {challenge.isError && (
        <Alert tone="error">{error?.message ?? 'Something went wrong. Please try again.'}</Alert>
      )}
      {useRecoveryCode ? (
        <FormField
          key="recovery"
          label="Recovery code"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          hint="Each recovery code works once."
          error={errors.code?.message}
          {...register('code')}
        />
      ) : (
        <FormField
          key="totp"
          label="Authentication code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          hint="Open your authenticator app and enter the 6-digit code for Sukoon Health."
          error={errors.code?.message}
          {...register('code')}
        />
      )}
      <Button type="submit" size="lg" loading={challenge.isPending} className="w-full">
        Verify and sign in
      </Button>
      <div className="flex flex-wrap justify-between gap-2 text-sm">
        <button
          type="button"
          className="font-semibold text-coral-ink hover:underline"
          onClick={() => {
            setUseRecoveryCode((value) => !value);
            reset({ code: '' });
            challenge.reset();
          }}
        >
          {useRecoveryCode ? 'Use your authenticator app' : 'Use a recovery code'}
        </button>
        <button type="button" className="text-ink-muted hover:underline" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </form>
  );
}
