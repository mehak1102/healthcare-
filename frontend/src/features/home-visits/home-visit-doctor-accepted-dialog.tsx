import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatHomeVisitInr, type HomeVisitRequest } from './api';

/** Modal when the visit moves to pay-after-accept (poll-detected). */
export function HomeVisitDoctorAcceptedDialog({
  visit,
  open,
  onClose,
  onPay,
  paying,
}: {
  visit: HomeVisitRequest;
  open: boolean;
  onClose: () => void;
  onPay: () => void;
  paying: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  const doctorLabel = visit.assignedDoctorName
    ? visit.assignedDoctorName.startsWith('Dr')
      ? visit.assignedDoctorName
      : `Dr. ${visit.assignedDoctorName}`
    : 'Your doctor';

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 z-50 m-auto w-[min(100%,24rem)] max-h-[90vh] overflow-auto rounded-[var(--radius-card)] border border-line bg-surface p-0 shadow-xl backdrop:bg-ink/40"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <div className="border-b border-line px-5 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-coral-ink">Doctor at home</p>
        <h2 className="mt-1 text-lg font-semibold text-ink">Doctor accepted</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {doctorLabel} accepted your visit. Pay {formatHomeVisitInr(visit.fee.amountMinor)} now to
          confirm — they can leave for your address after payment.
        </p>
      </div>
      <div className="flex flex-col gap-2 px-5 py-4">
        {visit.checkout ? (
          <Button disabled={paying} onClick={onPay}>
            {paying ? 'Opening payment…' : `Pay ${formatHomeVisitInr(visit.fee.amountMinor)}`}
          </Button>
        ) : (
          <p className="text-sm text-ink-muted">
            Payment is not available in this environment. Contact support if you need help.
          </p>
        )}
        <Button variant="secondary" type="button" onClick={onClose}>
          I&apos;ll pay on this page
        </Button>
      </div>
    </dialog>
  );
}
