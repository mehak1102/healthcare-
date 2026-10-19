import type { ReactNode } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { PageLoading } from '@/components/layout/page-loading';
import { safeRedirectPath } from '@/lib/safe-redirect';
import { homeForRoles } from './home-for-roles';
import { hasPermission, useCurrentUser } from './use-auth';

/**
 * UI-level gating only, for a better experience. Every protected endpoint is independently
 * enforced by the API.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: user, isPending, isError } = useCurrentUser();
  const location = useLocation();

  if (isPending) return <PageLoading />;
  if (isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="error" title="We could not check your session">
          Please refresh the page. If this keeps happening, try again in a few minutes.
        </Alert>
      </div>
    );
  }
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function RequirePermission({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const { data: user } = useCurrentUser();
  if (!hasPermission(user, permission)) {
    if (user?.staffMfaRequired) {
      return (
        <div className="mx-auto max-w-lg px-4 py-16">
          <Alert tone="warning" title="Turn on two-step verification first">
            Staff pages unlock once two-step verification is on.{' '}
            <Link to="/account" className="font-semibold underline">
              Go to your account
            </Link>
          </Alert>
        </div>
      );
    }
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <Alert tone="warning" title="You don't have access to this page">
          If you think you should, contact your administrator.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}

/** Must resolve to the same destination as the login page's own post-success redirect. */
export function RedirectIfSignedIn({ children }: { children: ReactNode }) {
  const { data: user, isPending } = useCurrentUser();
  const [params] = useSearchParams();
  if (isPending) return <PageLoading />;
  if (user) {
    const next = params.get('next');
    return <Navigate to={next ? safeRedirectPath(next) : homeForRoles(user.roles)} replace />;
  }
  return <>{children}</>;
}
