import {
  CalendarDays,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  Stethoscope,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { hasPermission, useCurrentUser, useLogout } from '@/features/auth/use-auth';
import { DoctorAccessCard } from '@/features/doctors/doctor-access-card';
import { usePageTitle } from '@/lib/use-page-title';
import { ChangePasswordCard } from './change-password-card';
import { DeleteAccountCard } from './delete-account-card';
import { SessionsCard } from './sessions-card';
import { VerifyEmailNotice } from './verify-email-notice';

const ROLE_LABELS: Record<string, string> = {
  patient: 'Patient',
  doctor: 'Doctor',
  clinic_staff: 'Clinic staff',
  diagnostic_partner: 'Diagnostic partner',
  homecare_provider: 'Home-care provider',
  transport_partner: 'Transport partner',
  support_agent: 'Support',
  operations_staff: 'Operations',
  finance_staff: 'Finance',
  platform_admin: 'Platform admin',
  super_admin: 'Super admin',
};

const memberSince = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' });

export function AccountPage() {
  usePageTitle('Your account');
  const { data: user } = useCurrentUser();
  const logout = useLogout();
  const navigate = useNavigate();
  if (!user) return null;

  const firstName = user.fullName.split(' ')[0];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Your account"
        title={`Hello, ${firstName}`}
        description="Manage your profile, security and the devices signed in to your account."
        actions={
          <>
            {user.roles.includes('patient') && (
              <Link to="/patient" className={buttonVariants({ variant: 'secondary' })}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Patient dashboard
              </Link>
            )}
            {user.roles.includes('doctor') && (
              <Link to="/doctor" className={buttonVariants({ variant: 'primary' })}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Doctor dashboard
              </Link>
            )}
            {hasPermission(user, 'provider:profile:manage-own') &&
              user.roles.includes('doctor') && (
                <>
                  <Link to="/doctor/profile" className={buttonVariants({ variant: 'primary' })}>
                    <Stethoscope className="size-4" aria-hidden="true" />
                    Your doctor profile
                  </Link>
                  <Link
                    to="/doctor/appointments"
                    className={buttonVariants({ variant: 'secondary' })}
                  >
                    <CalendarDays className="size-4" aria-hidden="true" />
                    Patient appointments
                  </Link>
                </>
              )}
            {hasPermission(user, 'appointments:self:book') && (
              <Link to="/appointments" className={buttonVariants({ variant: 'secondary' })}>
                <CalendarDays className="size-4" aria-hidden="true" />
                Your appointments
              </Link>
            )}
            {hasPermission(user, 'operations:dashboard') && (
              <Link to="/ops" className={buttonVariants({ variant: 'secondary' })}>
                <LayoutDashboard className="size-4" aria-hidden="true" />
                Operations dashboard
              </Link>
            )}
            {hasPermission(user, 'providers:verify') && (
              <Link
                to="/admin/doctor-applications"
                className={buttonVariants({ variant: 'secondary' })}
              >
                <Stethoscope className="size-4" aria-hidden="true" />
                Doctor applications
              </Link>
            )}
            {hasPermission(user, 'users:read') && (
              <Link to="/admin/users" className={buttonVariants({ variant: 'secondary' })}>
                <Users className="size-4" aria-hidden="true" />
                Manage users
              </Link>
            )}
            {hasPermission(user, 'catalog:manage') && (
              <Link
                to="/admin/public-holidays"
                className={buttonVariants({ variant: 'secondary' })}
              >
                <CalendarDays className="size-4" aria-hidden="true" />
                Public holidays
              </Link>
            )}
            <Button
              variant="ghost"
              loading={logout.isPending}
              onClick={() =>
                logout.mutate(undefined, { onSettled: () => navigate('/', { replace: true }) })
              }
            >
              <LogOut className="size-4" aria-hidden="true" />
              Sign out
            </Button>
          </>
        }
      />

      {/* Staff MFA lock is off for now. Restore with TwoStepCard when 2FA is required again.
      {user.staffMfaRequired && (
        <Alert tone="warning" title="Staff features are locked" className="mt-8">
          Turn on two-step verification below. Your staff tools unlock as soon as it is on.
        </Alert>
      )}
      */}

      <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 text-sm">
                <div>
                  <dt className="text-ink-muted">Name</dt>
                  <dd className="mt-0.5 font-semibold">{user.fullName}</dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Email</dt>
                  <dd className="mt-0.5 flex flex-wrap items-center gap-2 font-semibold break-all">
                    {user.email}
                    {user.emailVerified ? (
                      <Badge tone="success">
                        <ShieldCheck className="size-3" aria-hidden="true" /> Verified
                      </Badge>
                    ) : (
                      <Badge tone="warning">Not verified yet</Badge>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Account type</dt>
                  <dd className="mt-1 flex flex-wrap gap-1.5">
                    {user.roles.map((role) => (
                      <Badge key={role} tone="neutral">
                        {ROLE_LABELS[role] ?? role}
                      </Badge>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-ink-muted">Member since</dt>
                  <dd className="mt-0.5 font-semibold">
                    {memberSince.format(new Date(user.createdAt))}
                  </dd>
                </div>
              </dl>
              {!user.emailVerified && <VerifyEmailNotice email={user.email} />}
            </CardContent>
          </Card>
          {!user.roles.includes('doctor') && <DoctorAccessCard />}
          <ChangePasswordCard />
        </div>
        <div className="flex flex-col gap-6">
          {/* <TwoStepCard /> */}
          <SessionsCard />
          <DeleteAccountCard
            isDoctor={user.roles.includes('doctor')}
            mfaEnabled={user.mfaEnabled}
          />
        </div>
      </div>
    </div>
  );
}
