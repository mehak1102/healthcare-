import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { usePageTitle } from '@/lib/use-page-title';

interface LegalDraftPageProps {
  kind: 'privacy' | 'terms';
}

const CONTENT = {
  privacy: {
    title: 'Privacy Notice',
    points: [
      'We collect only what we need to provide care services, and we tell you why.',
      'Your health records are shared with a doctor only when you allow it, and access is logged.',
      'You can see and sign out the devices signed in to your account at any time.',
      'You will be able to withdraw consent, request a copy of your data, or ask us to correct or delete it, subject to legal retention duties for medical and financial records.',
      'We do not sell your personal data.',
    ],
  },
  terms: {
    title: 'Terms of Use',
    points: [
      'Sukoon is not an emergency service. In an emergency, call 112.',
      'Doctors listed on Sukoon are independent registered practitioners; their verification status is shown on their profile.',
      'Bookings, cancellations and refunds will follow the policies shown before you pay.',
      'You are responsible for keeping your password private and for activity on your account.',
    ],
  },
} as const;

export function LegalDraftPage({ kind }: LegalDraftPageProps) {
  const { title, points } = CONTENT[kind];
  usePageTitle(title);
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <PageHeader eyebrow="Draft" title={title} />
      <Alert tone="warning" className="mt-8" title="This is a draft summary">
        The full {title} is being prepared and will be reviewed by legal counsel before Sukoon opens
        to the public.
      </Alert>
      <h2 className="mt-10 text-xl font-semibold">Key commitments</h2>
      <ul className="mt-4 flex list-disc flex-col gap-3 pl-5 leading-relaxed text-ink-muted">
        {points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ul>
    </div>
  );
}
