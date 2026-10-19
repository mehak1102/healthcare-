import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PasswordField } from '@/components/ui/password-field';
import {
  changePasswordSchema,
  PASSWORD_MIN,
  type ChangePasswordValues,
} from '@/features/auth/schemas';
import { CURRENT_USER_KEY } from '@/features/auth/use-auth';
import { ApiError, setCsrfToken } from '@/lib/api-client';
import { accountApi } from './api';

export function ChangePasswordCard() {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const change = useMutation({
    mutationFn: accountApi.changePassword,
    onSuccess: ({ user, csrfToken }) => {
      setCsrfToken(csrfToken);
      queryClient.setQueryData(CURRENT_USER_KEY, user);
      void queryClient.invalidateQueries({ queryKey: ['account', 'sessions'] });
      reset();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'INVALID_CURRENT_PASSWORD') {
        setError('currentPassword', { message: error.message });
      }
    },
  });

  const onSubmit = handleSubmit(({ currentPassword, newPassword }) =>
    change.mutate({ currentPassword, newPassword }),
  );
  const otherError =
    change.error instanceof ApiError && change.error.code !== 'INVALID_CURRENT_PASSWORD'
      ? change.error
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Change password</CardTitle>
        <CardDescription>
          For your safety, this signs you out on every other device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
          {change.isSuccess && (
            <Alert tone="success">Password updated. Other devices have been signed out.</Alert>
          )}
          {otherError && (
            <Alert tone="error">
              {otherError.details.length ? otherError.details.join('. ') : otherError.message}
            </Alert>
          )}
          <PasswordField
            label="Current password"
            autoComplete="current-password"
            error={errors.currentPassword?.message}
            {...register('currentPassword')}
          />
          <PasswordField
            label="New password"
            autoComplete="new-password"
            hint={`At least ${PASSWORD_MIN} characters.`}
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />
          <PasswordField
            label="Confirm new password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
          <Button type="submit" loading={change.isPending} className="self-start">
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
