import { createBrowserRouter } from 'react-router';
import { AppLayout } from '@/components/layout/app-layout';
import { RedirectIfSignedIn, RequireAuth, RequirePermission } from '@/features/auth/route-guards';
import { HomePage } from '@/pages/home-page';
import { NotFoundPage } from '@/pages/not-found-page';
import { RouteErrorPage } from '@/pages/route-error-page';

export const router = createBrowserRouter([
  {
    Component: AppLayout,
    ErrorBoundary: RouteErrorPage,
    children: [
      { index: true, Component: HomePage },
      {
        path: 'login',
        lazy: async () => {
          const { LoginPage } = await import('@/features/auth/login-page');
          return {
            Component: () => (
              <RedirectIfSignedIn>
                <LoginPage />
              </RedirectIfSignedIn>
            ),
          };
        },
      },
      {
        path: 'register',
        lazy: async () => {
          const { RegisterPage } = await import('@/features/auth/register-page');
          return {
            Component: () => (
              <RedirectIfSignedIn>
                <RegisterPage />
              </RedirectIfSignedIn>
            ),
          };
        },
      },
      {
        path: 'forgot-password',
        lazy: async () => {
          const { ForgotPasswordPage } = await import('@/features/auth/forgot-password-page');
          return {
            Component: () => (
              <RedirectIfSignedIn>
                <ForgotPasswordPage />
              </RedirectIfSignedIn>
            ),
          };
        },
      },
      {
        path: 'reset-password',
        lazy: async () => ({
          Component: (await import('@/features/auth/reset-password-page')).ResetPasswordPage,
        }),
      },
      {
        path: 'verify-email',
        lazy: async () => ({
          Component: (await import('@/features/auth/verify-email-page')).VerifyEmailPage,
        }),
      },
      {
        path: 'patient',
        lazy: async () => {
          const { PatientDashboardPage } =
            await import('@/features/dashboards/patient-dashboard-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="appointments:self:book">
                  <PatientDashboardPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctor',
        lazy: async () => {
          const { DoctorDashboardPage } =
            await import('@/features/dashboards/doctor-dashboard-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="provider:profile:manage-own">
                  <DoctorDashboardPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'ops',
        lazy: async () => {
          const { OpsDashboardPage } = await import('@/features/operations/ops-dashboard-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="operations:dashboard">
                  <OpsDashboardPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'ops/home-visits',
        lazy: async () => {
          const { OpsHomeVisitsPage } = await import('@/features/operations/ops-home-visits-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="operations:dashboard">
                  <OpsHomeVisitsPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'care',
        lazy: async () => ({ Component: (await import('@/pages/info-pages')).CarePage }),
      },
      {
        path: 'doctor-at-home',
        lazy: async () => ({ Component: (await import('@/pages/info-pages')).DoctorAtHomePage }),
      },
      {
        path: 'online-consultation',
        lazy: async () => ({
          Component: (await import('@/pages/info-pages')).OnlineConsultationPage,
        }),
      },
      {
        path: 'diagnostics',
        lazy: async () => ({ Component: (await import('@/pages/info-pages')).DiagnosticsPage }),
      },
      {
        path: 'home-healthcare',
        lazy: async () => ({
          Component: (await import('@/pages/info-pages')).HomeHealthcarePage,
        }),
      },
      {
        path: 'health-packages',
        lazy: async () => ({
          Component: (await import('@/pages/info-pages')).HealthPackagesPage,
        }),
      },
      {
        path: 'health-library',
        lazy: async () => ({
          Component: (await import('@/pages/info-pages')).HealthLibraryPage,
        }),
      },
      {
        path: 'about',
        lazy: async () => ({ Component: (await import('@/pages/info-pages')).AboutPage }),
      },
      {
        path: 'contact',
        lazy: async () => ({ Component: (await import('@/pages/info-pages')).ContactPage }),
      },
      {
        path: 'account',
        lazy: async () => {
          const { AccountPage } = await import('@/features/account/account-page');
          return {
            Component: () => (
              <RequireAuth>
                <AccountPage />
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'admin/users',
        lazy: async () => {
          const { AdminUsersPage } = await import('@/features/admin/admin-users-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="users:read">
                  <AdminUsersPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'admin/doctor-applications',
        lazy: async () => {
          const { AdminDoctorApplicationsPage } =
            await import('@/features/doctors/admin-doctor-applications-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="providers:verify">
                  <AdminDoctorApplicationsPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'admin/public-holidays',
        lazy: async () => {
          const { AdminPublicHolidaysPage } =
            await import('@/features/admin/admin-public-holidays-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="catalog:manage">
                  <AdminPublicHolidaysPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctors',
        lazy: async () => ({
          Component: (await import('@/features/doctors/find-doctors-page')).FindDoctorsPage,
        }),
      },
      {
        path: 'doctors/:slug',
        lazy: async () => ({
          Component: (await import('@/features/doctors/doctor-public-page')).DoctorPublicPage,
        }),
      },
      {
        path: 'doctor/profile',
        lazy: async () => {
          const { DoctorProfileEditorPage } =
            await import('@/features/doctors/doctor-profile-editor-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="provider:profile:manage-own">
                  <DoctorProfileEditorPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctor/schedule',
        lazy: async () => {
          const { DoctorSchedulePage } =
            await import('@/features/appointments/doctor-schedule-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="provider:schedule:manage-own">
                  <DoctorSchedulePage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctor/appointments',
        lazy: async () => {
          const { DoctorAppointmentsPage } =
            await import('@/features/appointments/doctor-appointments-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="provider:appointments:handle">
                  <DoctorAppointmentsPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctor/appointments/:id/call',
        lazy: async () => {
          const { VideoCallPage } = await import('@/features/appointments/video-call-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="provider:appointments:handle">
                  <VideoCallPage as="doctor" />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'appointments',
        lazy: async () => {
          const { MyAppointmentsPage } =
            await import('@/features/appointments/my-appointments-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="appointments:self:book">
                  <MyAppointmentsPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'appointments/:id',
        lazy: async () => {
          const { AppointmentDetailPage } =
            await import('@/features/appointments/appointment-detail-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="appointments:self:book">
                  <AppointmentDetailPage />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'appointments/:id/call',
        lazy: async () => {
          const { VideoCallPage } = await import('@/features/appointments/video-call-page');
          return {
            Component: () => (
              <RequireAuth>
                <RequirePermission permission="appointments:self:book">
                  <VideoCallPage as="patient" />
                </RequirePermission>
              </RequireAuth>
            ),
          };
        },
      },
      {
        path: 'doctors/join',
        lazy: async () => ({
          Component: (await import('@/features/doctors/doctor-join-page')).DoctorJoinPage,
        }),
      },
      {
        path: 'emergency',
        lazy: async () => ({ Component: (await import('@/pages/emergency-page')).EmergencyPage }),
      },
      {
        path: 'privacy',
        lazy: async () => {
          const { LegalDraftPage } = await import('@/pages/legal-draft-page');
          return { Component: () => <LegalDraftPage kind="privacy" /> };
        },
      },
      {
        path: 'terms',
        lazy: async () => {
          const { LegalDraftPage } = await import('@/pages/legal-draft-page');
          return { Component: () => <LegalDraftPage kind="terms" /> };
        },
      },
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
