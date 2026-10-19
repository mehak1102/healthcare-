import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { PasswordField } from '@/components/ui/password-field';
import { Skeleton } from '@/components/ui/skeleton';
import { authenticatorCodeSchema } from '@/features/auth/schemas';
import { CURRENT_USER_KEY } from '@/features/auth/use-auth';
import { ApiError } from '@/lib/api-client';
import { accountApi, type MfaSetup } from './api';
import { RecoveryCodesPanel } from './recovery-codes-panel';

const MFA_STATUS_KEY = ['account', 'mfa'] as const;
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

const passwordSchema = z.object({ password: z.string().min(1, 'Enter your password') });
const codeSchema = z.object({ code: authenticatorCodeSchema });
const disableSchema = z.object({
  password: z.string().min(1, 'Enter your password'),
  code: z.string().trim().min(6, 'Enter a code from your app, or a recovery code'),
});

type Step =
  | { name: 'idle' }
  | { name: 'password' }
  | { name: 'scan'; setup: MfaSetup }
  | { name: 'codes'; codes: string[] }
  | { name: 'regenerate' }
  | { name: 'disable' };

function errorText(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  return error.details.length ? error.details.join('. ') : error.message;
}

export function TwoStepCard() {
  const queryClient = useQueryClient();
  const status = useQuery({ queryKey: MFA_STATUS_KEY, queryFn: accountApi.mfaStatus });
  const [step, setStep] = useState<Step>({ name: 'idle' });

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: MFA_STATUS_KEY });
    void queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY });
    void queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] });
  };
  const finish = () => {
    refresh();
    setStep({ name: 'idle' });
  };
  const cancel = () => setStep({ name: 'idle' });

  const enabled = status.data?.enabled ?? false;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Two-step verification
          {status.data &&
            (enabled ? (
              <Badge tone="success">
                <ShieldCheck className="size-3" aria-hidden="true" /> On
              </Badge>
            ) : (
              <Badge tone="warning">Off</Badge>
            ))}
        </CardTitle>
        <CardDescription>
          After your password, sign-in also asks for a code from an authenticator app on your phone
          (for example Google Authenticator, Microsoft Authenticator or 1Password).
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {status.isPending && <Skeleton className="h-12" />}
        {status.isError && (
          <Alert tone="error">We could not load this setting. Please refresh the page.</Alert>
        )}

        {step.name === 'password' && (
          <PasswordStep onCancel={cancel} onReady={(setup) => setStep({ name: 'scan', setup })} />
        )}
        {step.name === 'scan' && (
          <ScanStep
            setup={step.setup}
            onCancel={cancel}
            onRestart={() => setStep({ name: 'password' })}
            onEnabled={(codes) => {
              refresh();
              setStep({ name: 'codes', codes });
            }}
          />
        )}
        {step.name === 'codes' && <RecoveryCodesPanel codes={step.codes} onDone={finish} />}
        {step.name === 'regenerate' && (
          <RegenerateStep onCancel={cancel} onDone={(codes) => setStep({ name: 'codes', codes })} />
        )}
        {step.name === 'disable' && <DisableStep onCancel={cancel} onDone={finish} />}

        {step.name === 'idle' && status.data && !enabled && (
          <Button className="self-start" onClick={() => setStep({ name: 'password' })}>
            Turn on two-step verification
          </Button>
        )}
        {step.name === 'idle' && status.data && enabled && (
          <>
            <p className="text-sm text-ink-muted">
              {status.data.enrolledAt &&
                `On since ${dateFormat.format(new Date(status.data.enrolledAt))}. `}
              {status.data.recoveryCodesRemaining} of 10 recovery codes left.
            </p>
            {status.data.recoveryCodesRemaining <= 3 && (
              <Alert tone="warning">
                You are running low on recovery codes. Get a new set so you can still sign in if you
                lose your phone.
              </Alert>
            )}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => setStep({ name: 'regenerate' })}>
                Get new recovery codes
              </Button>
              {status.data.canDisable ? (
                <Button variant="danger" onClick={() => setStep({ name: 'disable' })}>
                  Turn off
                </Button>
              ) : (
                <p className="self-center text-sm text-ink-muted">Required for staff accounts.</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PasswordStep({
  onCancel,
  onReady,
}: {
  onCancel: () => void;
  onReady: (setup: MfaSetup) => void;
}) {
  const start = useMutation({ mutationFn: accountApi.startMfaSetup, onSuccess: onReady });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof passwordSchema>>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { password: '' },
  });
  return (
    <form
      onSubmit={handleSubmit(({ password }) => start.mutate(password))}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-sm">To keep your account safe, confirm your password first.</p>
      {start.isError && <Alert tone="error">{errorText(start.error)}</Alert>}
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <StepActions submitLabel="Continue" loading={start.isPending} onCancel={onCancel} />
    </form>
  );
}

function ScanStep({
  setup,
  onCancel,
  onRestart,
  onEnabled,
}: {
  setup: MfaSetup;
  onCancel: () => void;
  onRestart: () => void;
  onEnabled: (codes: string[]) => void;
}) {
  const enable = useMutation({
    mutationFn: accountApi.enableMfa,
    onSuccess: ({ recoveryCodes }) => onEnabled(recoveryCodes),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof codeSchema>, unknown, z.output<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });
  const expiredError =
    enable.error instanceof ApiError && enable.error.code === 'MFA_SETUP_EXPIRED'
      ? enable.error
      : null;

  if (expiredError) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="error">{expiredError.message}</Alert>
        <Button className="self-start" onClick={onRestart}>
          Start again
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(({ code }) => enable.mutate(code))}
      noValidate
      className="flex flex-col gap-4"
    >
      <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm">
        <li>Open your authenticator app and add a new account.</li>
        <li>Scan this QR code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="self-start rounded-[var(--radius-control)] border border-line bg-white p-3">
        <QRCodeSVG value={setup.otpauthUri} size={168} title="QR code for your authenticator app" />
      </div>
      <div className="text-sm">
        <p className="text-ink-muted">Can't scan? Enter this key:</p>
        <code className="mt-1 block font-mono font-semibold tracking-wider break-all">
          {setup.secret.match(/.{1,4}/g)?.join(' ')}
        </code>
      </div>
      {enable.isError && <Alert tone="error">{errorText(enable.error)}</Alert>}
      <FormField
        label="6-digit code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        error={errors.code?.message}
        {...register('code')}
      />
      <StepActions submitLabel="Turn on" loading={enable.isPending} onCancel={onCancel} />
    </form>
  );
}

function RegenerateStep({
  onCancel,
  onDone,
}: {
  onCancel: () => void;
  onDone: (codes: string[]) => void;
}) {
  const regenerate = useMutation({
    mutationFn: accountApi.regenerateRecoveryCodes,
    onSuccess: ({ recoveryCodes }) => onDone(recoveryCodes),
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.input<typeof codeSchema>, unknown, z.output<typeof codeSchema>>({
    resolver: zodResolver(codeSchema),
    defaultValues: { code: '' },
  });
  return (
    <form
      onSubmit={handleSubmit(({ code }) => regenerate.mutate(code))}
      noValidate
      className="flex flex-col gap-4"
    >
      <p className="text-sm">Your current recovery codes will stop working.</p>
      {regenerate.isError && <Alert tone="error">{errorText(regenerate.error)}</Alert>}
      <FormField
        label="Code from your authenticator app"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={7}
        error={errors.code?.message}
        {...register('code')}
      />
      <StepActions submitLabel="Get new codes" loading={regenerate.isPending} onCancel={onCancel} />
    </form>
  );
}

function DisableStep({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const disable = useMutation({ mutationFn: accountApi.disableMfa, onSuccess: onDone });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof disableSchema>>({
    resolver: zodResolver(disableSchema),
    defaultValues: { password: '', code: '' },
  });
  return (
    <form
      onSubmit={handleSubmit((values) => disable.mutate(values))}
      noValidate
      className="flex flex-col gap-4"
    >
      <Alert tone="warning">
        Without two-step verification, anyone who learns your password can sign in.
      </Alert>
      {disable.isError && <Alert tone="error">{errorText(disable.error)}</Alert>}
      <PasswordField
        label="Current password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />
      <FormField
        label="Code from your app, or a recovery code"
        autoComplete="one-time-code"
        error={errors.code?.message}
        {...register('code')}
      />
      <StepActions submitLabel="Turn off" loading={disable.isPending} onCancel={onCancel} danger />
    </form>
  );
}

function StepActions({
  submitLabel,
  loading,
  onCancel,
  danger = false,
}: {
  submitLabel: string;
  loading: boolean;
  onCancel: () => void;
  danger?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="submit" variant={danger ? 'danger' : 'primary'} loading={loading}>
        {submitLabel}
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}
