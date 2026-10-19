import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, FileText, Stethoscope } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { CURRENT_USER_KEY, useCurrentUser } from '@/features/auth/use-auth';
import { ApiError } from '@/lib/api-client';
import { withNext } from '@/lib/safe-redirect';
import { usePageTitle } from '@/lib/use-page-title';
import { doctorsApi, MY_APPLICATION_KEY, type DoctorApplication } from './api';
import { ApplicationSummary } from './application-summary';
import { doctorApplicationSchema, type DoctorApplicationValues } from './schemas';

const JOIN_PATH = '/doctors/join';
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

const STEPS = [
  {
    icon: FileText,
    title: 'Tell us your registration',
    text: 'Your medical council, registration number and qualifications.',
  },
  {
    icon: ClipboardCheck,
    title: 'We check the official register',
    text: 'Our team matches your details against the NMC or state council register.',
  },
  {
    icon: Stethoscope,
    title: 'Your doctor account opens',
    text: 'Once approved, the same sign-in gives you access to doctor tools.',
  },
];

export function DoctorJoinPage() {
  usePageTitle('Join as a doctor');
  const { data: user, isPending } = useCurrentUser();

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="For doctors"
        title="Join Sukoon Health as a doctor"
        description="Register as a doctor to open your practice dashboard immediately. Patients can book you only after an administrator verifies your registration. You cannot approve yourself."
      />

      <ol className="mt-8 grid gap-4 sm:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, index) => (
          <li
            key={title}
            className="rounded-[var(--radius-card)] border border-line bg-surface p-5"
          >
            <Icon className="size-5 text-coral-ink" aria-hidden="true" />
            <p className="mt-3 font-semibold">
              {index + 1}. {title}
            </p>
            <p className="mt-1 text-sm text-ink-muted">{text}</p>
          </li>
        ))}
      </ol>

      <div className="mt-8">
        {isPending ? (
          <PageLoading />
        ) : user ? (
          <SignedInJoin isDoctor={user.roles.includes('doctor')} />
        ) : (
          <SignedOutJoin />
        )}
      </div>
    </div>
  );
}

function SignedOutJoin() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>First, sign in or create your account</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">
          You will come straight back here to enter your registration details.
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Link
            to={withNext('/register', JOIN_PATH)}
            className={buttonVariants({ variant: 'primary' })}
          >
            Create an account
          </Link>
          <Link
            to={withNext('/login', JOIN_PATH)}
            className={buttonVariants({ variant: 'secondary' })}
          >
            I already have an account
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function SignedInJoin({ isDoctor }: { isDoctor: boolean }) {
  const mine = useQuery({ queryKey: MY_APPLICATION_KEY, queryFn: doctorsApi.myApplication });

  if (isDoctor) {
    return (
      <Alert tone="success" title="Your account already has doctor access">
        <Link to="/doctor/profile" className="font-semibold underline">
          Fill in and publish your doctor profile
        </Link>
      </Alert>
    );
  }
  if (mine.isPending) return <PageLoading />;
  if (mine.isError) {
    return <Alert tone="error">We could not load your application. Please refresh the page.</Alert>;
  }

  const application = mine.data.application;
  if (application?.status === 'pending') return <PendingApplication application={application} />;
  if (application?.status === 'approved') return <ApprovedApplication />;
  return <ApplicationForm previous={application} />;
}

function PendingApplication({ application }: { application: DoctorApplication }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Your application is being reviewed</CardTitle>
        <Badge tone="warning">Under review</Badge>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-muted">
          Submitted on {dateFormat.format(new Date(application.submittedAt))}. We will email you
          when a decision is made.
        </p>
        <ApplicationSummary application={application} />
      </CardContent>
    </Card>
  );
}

function ApprovedApplication() {
  const queryClient = useQueryClient();
  return (
    <Alert tone="success" title="Your application has been approved">
      <button
        type="button"
        className="font-semibold underline"
        onClick={() => queryClient.invalidateQueries({ queryKey: CURRENT_USER_KEY })}
      >
        Refresh your access
      </button>
    </Alert>
  );
}

const SERVER_FIELD_MESSAGES: Record<string, string> = {
  APPLICATION_PENDING: 'You already have an application waiting for review.',
  ALREADY_A_DOCTOR: 'This account already has doctor access.',
};

function ApplicationForm({ previous }: { previous: DoctorApplication | null }) {
  const queryClient = useQueryClient();
  const apply = useMutation({
    mutationFn: doctorsApi.apply,
    onSuccess: (application) => queryClient.setQueryData(MY_APPLICATION_KEY, { application }),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DoctorApplicationValues>({
    resolver: zodResolver(doctorApplicationSchema),
    defaultValues: {
      registrationNumber: previous?.registrationNumber ?? '',
      registrationCouncil: previous?.registrationCouncil ?? '',
      registrationYear: previous ? String(previous.registrationYear) : '',
      qualification: previous?.qualification ?? '',
      specialty: previous?.specialty ?? '',
    },
  });

  const onSubmit = handleSubmit((values) =>
    apply.mutate(
      { ...values, registrationYear: Number(values.registrationYear) },
      {
        onError: (error) => {
          if (error instanceof ApiError && error.code === 'REGISTRATION_IN_USE') {
            setError('registrationNumber', { message: error.message });
          }
        },
      },
    ),
  );

  const serverError =
    apply.error instanceof ApiError && apply.error.code !== 'REGISTRATION_IN_USE'
      ? apply.error
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{previous ? 'Apply again' : 'Your medical registration'}</CardTitle>
      </CardHeader>
      <CardContent>
        {previous?.status === 'rejected' && (
          <Alert tone="warning" title="We could not approve your last application" className="mb-5">
            {previous.rejectionReason}
          </Alert>
        )}
        <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
          {serverError && (
            <Alert tone="error" title="We could not send your application">
              {SERVER_FIELD_MESSAGES[serverError.code] ??
                (serverError.details.length > 0
                  ? serverError.details.join('. ')
                  : serverError.message)}
            </Alert>
          )}
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              label="Medical council"
              hint="For example: National Medical Commission, or Karnataka Medical Council"
              autoComplete="off"
              error={errors.registrationCouncil?.message}
              {...register('registrationCouncil')}
            />
            <FormField
              label="Registration number"
              hint="Exactly as on your registration certificate"
              autoComplete="off"
              error={errors.registrationNumber?.message}
              {...register('registrationNumber')}
            />
            <FormField
              label="Year of registration"
              inputMode="numeric"
              maxLength={4}
              autoComplete="off"
              error={errors.registrationYear?.message}
              {...register('registrationYear')}
            />
            <FormField
              label="Speciality"
              hint="For example: General Physician, Paediatrics"
              error={errors.specialty?.message}
              {...register('specialty')}
            />
          </div>
          <FormField
            label="Qualifications"
            hint="For example: MBBS, MD (General Medicine)"
            error={errors.qualification?.message}
            {...register('qualification')}
          />
          <p className="text-sm text-ink-muted">
            By applying you confirm these details are yours and correct. We check them against the
            official register, and applications with incorrect details are rejected.
          </p>
          <Button type="submit" size="lg" loading={apply.isPending} className="sm:self-start">
            Send for review
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
