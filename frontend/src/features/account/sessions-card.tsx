import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { CURRENT_USER_KEY } from '@/features/auth/use-auth';
import { setCsrfToken } from '@/lib/api-client';
import { accountApi } from './api';
import { describeDevice } from './describe-device';

const SESSIONS_KEY = ['account', 'sessions'] as const;
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' });

export function SessionsCard() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const sessions = useQuery({ queryKey: SESSIONS_KEY, queryFn: accountApi.listSessions });

  const revoke = useMutation({
    mutationFn: (session: { id: string; current: boolean }) => accountApi.revokeSession(session.id),
    onSuccess: (_, session) => {
      if (session.current) {
        setCsrfToken(null);
        queryClient.clear();
        queryClient.setQueryData(CURRENT_USER_KEY, null);
        navigate('/login', { replace: true });
        return;
      }
      void queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    },
  });

  const revokeOthers = useMutation({
    mutationFn: accountApi.revokeOtherSessions,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_KEY }),
  });

  const items = sessions.data?.items ?? [];
  const otherCount = items.filter((session) => !session.current).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Where you're signed in</CardTitle>
        <CardDescription>
          If you don't recognise a device, sign it out and change your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {sessions.isPending && (
          <div className="flex flex-col gap-3" role="status">
            <span className="sr-only">Loading sessions…</span>
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        )}
        {sessions.isError && (
          <Alert tone="error">We could not load your sessions. Please refresh the page.</Alert>
        )}
        {(revoke.isError || revokeOthers.isError) && (
          <Alert tone="error">That did not work. Please try again.</Alert>
        )}
        {revokeOthers.isSuccess && (
          <Alert tone="success">
            Signed out of {revokeOthers.data.revoked} other{' '}
            {revokeOthers.data.revoked === 1 ? 'device' : 'devices'}.
          </Alert>
        )}

        {items.length > 0 && (
          <ul className="flex flex-col divide-y divide-line rounded-[var(--radius-control)] border border-line">
            {items.map((session) => {
              const device = describeDevice(session.userAgent);
              const Icon = device.mobile ? Smartphone : Monitor;
              return (
                <li key={session.id} className="flex flex-wrap items-center gap-4 p-4">
                  <span className="grid size-10 place-items-center rounded-xl bg-sand">
                    <Icon className="size-5 text-ink-muted" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {device.label}
                      {session.current && <Badge tone="success">This device</Badge>}
                    </p>
                    <p className="text-sm text-ink-muted">
                      Last active {dateFormat.format(new Date(session.lastSeenAt))}
                      {session.ipAddress && ` · ${session.ipAddress}`}
                    </p>
                  </div>
                  <Button
                    variant={session.current ? 'secondary' : 'danger'}
                    size="sm"
                    loading={revoke.isPending && revoke.variables?.id === session.id}
                    onClick={() => revoke.mutate({ id: session.id, current: session.current })}
                    aria-label={`Sign out ${device.label}${session.current ? ' (this device)' : ''}`}
                  >
                    Sign out
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {otherCount > 0 && (
          <Button
            variant="secondary"
            className="self-start"
            loading={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Sign out of all other devices
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
