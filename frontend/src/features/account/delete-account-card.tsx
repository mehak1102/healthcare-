import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import { z } from 'zod';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { PasswordField } from '@/components/ui/password-field';
import type { LoginNotice } from '@/features/auth/reset-password-page';
import { CURRENT_USER_KEY } from '@/features/auth/use-auth';
import { ApiError, setCsrfToken } from '@/lib/api-client';
import { accountApi } from './api';

const schema = z.object({
  password: z.string().min(1, 'Enter your password'),
  code: z.string().trim(),
  understood: z.boolean().refine((value) => value, 'Tick this box to confirm'),
});
type Values = z.infer<typeof schema>;

export function DeleteAccountCard({
  isDoctor,
  mfaEnabled,
}: {
  isDoctor: boolean;
  mfaEnabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', code: '', understood: false },
  });

  const remove = useMutation({
    mutationFn: accountApi.deleteAccount,
    onSuccess: () => {
      const notice: LoginNotice = { accountDeleted: true };
      void navigate('/login', { replace: true, state: notice });
      setCsrfToken(null);
      queryClient.clear();
      queryClient.setQueryData(CURRENT_USER_KEY, null);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
        setError('password', { message: error.message });
      }
    },
  });

  const onSubmit = handleSubmit(({ password, code }) => {
    if (mfaEnabled && code.length < 6) {
      setError('code', { message: 'Enter a code from your app, or a recovery code' });
      return;
    }
    remove.mutate(mfaEnabled ? { password, code } : { password });
  });
  const error =
    remove.error instanceof ApiError && remove.error.code !== 'INVALID_CURRENT_PASSWORD'
      ? remove.error
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>
          Permanently delete your account and sign out on every device. This cannot be undone.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!open ? (
          <Button variant="danger" className="self-start" onClick={() => setOpen(true)}>
            Delete my account
          </Button>
        ) : (
          <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 text-sm">
              <p className="font-semibold">What happens</p>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                <li>Your sign-in, name and email are deleted.</li>
                {isDoctor && (
                  <li>
                    Your doctor profile, application and timetable are removed, so patients can no
                    longer find or book you.
                  </li>
                )}
                <li>
                  Past appointments and payment records are kept as medical and financial records,
                  and so is the security log.
                </li>
                <li>
                  You need to cancel any upcoming appointments first. Paid appointments are refunded
                  in full.
                </li>
              </ul>
            </div>
            {error?.code === 'ACCOUNT_HAS_OPEN_APPOINTMENTS' ? (
              <Alert tone="error">
                {error.message}{' '}
                <Link
                  to={isDoctor ? '/doctor/appointments' : '/appointments'}
                  className="font-semibold underline"
                >
                  See appointments
                </Link>
              </Alert>
            ) : (
              error && <Alert tone="error">{error.message}</Alert>
            )}
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              error={errors.password?.message}
              {...register('password')}
            />
            {mfaEnabled && (
              <FormField
                label="Code from your app, or a recovery code"
                autoComplete="one-time-code"
                error={errors.code?.message}
                {...register('code')}
              />
            )}
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1" {...register('understood')} />
              <span>I understand that my account will be deleted permanently.</span>
            </label>
            {errors.understood && (
              <p className="text-sm text-danger-ink">{errors.understood.message}</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" loading={remove.isPending}>
                Delete permanently
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                  remove.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
