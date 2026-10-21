import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { useId, useState } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { usePageTitle } from '@/lib/use-page-title';
import { doctorsApi, type AdminDoctorApplication, type DoctorApplicationStatus } from './api';
import { ApplicationSummary } from './application-summary';
import { rejectionSchema } from './schemas';

const TABS: { value: DoctorApplicationStatus; label: string }[] = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const PAGE_SIZE = 20;
const NMC_REGISTER_URL = 'https://www.nmc.org.in/information-desk/indian-medical-register/';
const dateFormat = new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' });

export function AdminDoctorApplicationsPage() {
  usePageTitle('Doctor applications');
  const [status, setStatus] = useState<DoctorApplicationStatus>('pending');
  const [page, setPage] = useState(1);

  const list = useQuery({
    queryKey: ['admin', 'doctor-applications', { status, page }],
    queryFn: ({ signal }) => doctorsApi.list(status, page, signal),
    placeholderData: keepPreviousData,
  });
  const totalPages = list.data ? Math.max(1, Math.ceil(list.data.total / PAGE_SIZE)) : 1;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Administration"
        title="Doctor applications"
        description="Check each registration in the official register before approving. Every view and decision is recorded in the audit log."
      />

      <Alert tone="info" className="mt-8">
        Search the{' '}
        <a
          href={NMC_REGISTER_URL}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex items-center gap-1 font-semibold underline"
        >
          NMC Indian Medical Register <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>{' '}
        or the state medical council&apos;s register. Approve only when the name, council,
        registration number and year all match.
      </Alert>

      <div role="tablist" aria-label="Application status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={cn(
              'rounded-full border px-4 py-2 text-sm font-semibold transition-colors',
              status === tab.value
                ? 'border-coral-ink bg-coral-ink text-white'
                : 'border-line bg-surface text-ink-muted hover:border-rose hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-4" role="tabpanel">
        {list.isError && (
          <Alert tone="error">
            {list.error instanceof ApiError
              ? list.error.code === 'MFA_REQUIRED'
                ? 'Turn on two-step verification in your account before reviewing applications.'
                : list.error.message
              : 'We could not load applications. Please try again.'}
          </Alert>
        )}
        {list.isPending && (
          <div className="flex flex-col gap-3" role="status">
            <span className="sr-only">Loading applications…</span>
            {Array.from({ length: 3 }, (_, index) => (
              <Skeleton key={index} className="h-40" />
            ))}
          </div>
        )}
        {list.data && list.data.items.length === 0 && (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-semibold">Nothing here right now</p>
              <p className="mt-1 text-sm text-ink-muted">
                {status === 'pending'
                  ? 'New applications appear here, oldest first.'
                  : 'Reviewed applications appear here, most recent first.'}
              </p>
            </CardContent>
          </Card>
        )}
        {list.data?.items.map((application) => (
          <ApplicationCard key={application.id} application={application} />
        ))}
      </div>

      {list.data && list.data.total > PAGE_SIZE && (
        <nav aria-label="Pagination" className="mt-5 flex items-center justify-between gap-4">
          <p className="text-sm text-ink-muted">
            Page {list.data.page} of {totalPages} · {list.data.total} applications
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="size-4" aria-hidden="true" /> Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}

function ApplicationCard({ application }: { application: AdminDoctorApplication }) {
  const { applicant } = application;
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-lg font-semibold">{applicant?.fullName ?? 'Deleted account'}</p>
            {applicant && (
              <p className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                {applicant.email}
                {applicant.emailVerified ? (
                  <Badge tone="success">Email verified</Badge>
                ) : (
                  <Badge tone="warning">Email not verified</Badge>
                )}
              </p>
            )}
          </div>
          <p className="text-sm text-ink-muted">
            Submitted {dateFormat.format(new Date(application.submittedAt))}
          </p>
        </div>
        <ApplicationSummary application={application} />
        {application.status === 'pending' ? (
          <ReviewControls application={application} />
        ) : (
          <div className="mt-4 border-t border-line pt-4 text-sm">
            <Badge tone={application.status === 'approved' ? 'success' : 'warning'}>
              {application.status === 'approved' ? 'Approved' : 'Rejected'}
            </Badge>
            {application.reviewedAt && (
              <span className="ml-2 text-ink-muted">
                on {dateFormat.format(new Date(application.reviewedAt))}
              </span>
            )}
            {application.rejectionReason && (
              <p className="mt-2">Reason given: {application.rejectionReason}</p>
            )}
            {application.reviewNote && (
              <p className="mt-2 text-ink-muted">Internal note: {application.reviewNote}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReviewControls({ application }: { application: AdminDoctorApplication }) {
  const queryClient = useQueryClient();
  const ids = useId();
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | null>(null);

  const onDone = () =>
    queryClient.invalidateQueries({ queryKey: ['admin', 'doctor-applications'] });
  const approve = useMutation({
    mutationFn: () => doctorsApi.approve(application.id, note.trim()),
    onSuccess: onDone,
  });
  const reject = useMutation({
    mutationFn: (text: string) => doctorsApi.reject(application.id, text),
    onSuccess: onDone,
  });
  const error = approve.error ?? reject.error;

  const onReject = () => {
    const parsed = rejectionSchema.safeParse(reason);
    if (!parsed.success) {
      setReasonError(parsed.error.issues[0]?.message ?? 'Enter a reason');
      return;
    }
    setReasonError(null);
    reject.mutate(parsed.data);
  };

  const busy = approve.isPending || reject.isPending;

  return (
    <div className="mt-5 grid gap-5 border-t border-line pt-5 md:grid-cols-2">
      {error && (
        <Alert tone="error" className="md:col-span-2">
          {error instanceof ApiError ? error.message : 'Something went wrong. Please try again.'}
        </Alert>
      )}
      <div className="flex flex-col gap-3">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1 size-4 shrink-0 accent-coral-ink"
            checked={checked}
            onChange={(event) => setChecked(event.target.checked)}
          />
          <span>I found this registration in the official register and the details match.</span>
        </label>
        <label htmlFor={`${ids}-note`} className="text-sm font-semibold">
          Internal note (optional)
        </label>
        <input
          id={`${ids}-note`}
          value={note}
          maxLength={500}
          onChange={(event) => setNote(event.target.value)}
          className="h-11 rounded-[var(--radius-control)] border border-line bg-surface px-3 text-sm hover:border-rose focus-visible:border-coral-ink"
        />
        <Button
          disabled={!checked || busy}
          loading={approve.isPending}
          onClick={() => approve.mutate()}
          className="self-start"
        >
          Approve as doctor
        </Button>
      </div>
      <div className="flex flex-col gap-3">
        <label htmlFor={`${ids}-reason`} className="text-sm font-semibold">
          Reason for rejection (shown to the applicant)
        </label>
        <textarea
          id={`${ids}-reason`}
          value={reason}
          rows={3}
          maxLength={500}
          aria-invalid={reasonError ? true : undefined}
          aria-describedby={reasonError ? `${ids}-reason-error` : undefined}
          onChange={(event) => setReason(event.target.value)}
          className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm hover:border-rose focus-visible:border-coral-ink"
        />
        {reasonError && (
          <p id={`${ids}-reason-error`} className="text-sm font-medium text-danger-ink">
            {reasonError}
          </p>
        )}
        <Button
          variant="secondary"
          disabled={busy}
          loading={reject.isPending}
          onClick={onReject}
          className="self-start"
        >
          Reject
        </Button>
      </div>
    </div>
  );
}
