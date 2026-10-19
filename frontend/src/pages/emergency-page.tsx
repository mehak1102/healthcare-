import { Phone, ShieldAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { usePageTitle } from '@/lib/use-page-title';

/** Copy is intentionally brief and generic until it has been reviewed by the clinical governance owner. */
export function EmergencyPage() {
  usePageTitle('Emergency help');
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <div className="rounded-[2rem] border border-danger-ink/20 bg-danger-surface p-7 sm:p-10">
        <ShieldAlert className="size-9 text-danger-ink" aria-hidden="true" />
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">In an emergency, call 112 now</h1>
        <p className="mt-3 text-lg leading-relaxed text-ink">
          If you or someone with you may be in danger, has a life-threatening condition, or needs
          urgent medical help, call India's national emergency number or go to the nearest hospital
          emergency department.
        </p>
        <a
          href="tel:112"
          className="mt-7 inline-flex h-14 items-center gap-3 rounded-2xl bg-danger-ink px-7 text-lg font-bold text-white shadow-[var(--shadow-lifted)] hover:bg-[#86321f]"
        >
          <Phone className="size-5" aria-hidden="true" />
          Call 112
        </a>
      </div>

      <div className="mt-10 flex flex-col gap-5 text-ink">
        <h2 className="text-2xl font-semibold">What Sukoon can and cannot do</h2>
        <ul className="flex list-disc flex-col gap-2 pl-5 leading-relaxed text-ink-muted">
          <li>Sukoon is not an emergency service and cannot dispatch emergency responders.</li>
          <li>
            Do not wait for an online consultation or a home visit when a situation may be
            life-threatening.
          </li>
          <li>
            Online symptom information on this site is not a diagnosis and cannot tell you that you
            are safe.
          </li>
        </ul>
        <Alert tone="info">
          This guidance is being reviewed by our clinical team and will be expanded.
        </Alert>
      </div>
    </div>
  );
}
