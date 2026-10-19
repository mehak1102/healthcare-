import { Phone } from 'lucide-react';
import { Link } from 'react-router';

/** Always visible: this platform is not an emergency service. Copy pending clinical review. */
export function EmergencyNotice() {
  return (
    <div className="border-b border-line bg-sand">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-[0.8rem] text-ink sm:text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Phone className="size-3.5 text-coral-ink" aria-hidden="true" />
          Medical emergency? Call{' '}
          <a href="tel:112" className="underline underline-offset-2">
            112
          </a>{' '}
          now.
        </span>
        <span className="text-ink-muted">Sukoon is not an emergency service.</span>
        <Link
          to="/emergency"
          className="font-semibold text-coral-ink underline-offset-2 hover:underline"
        >
          What to do in an emergency
        </Link>
      </div>
    </div>
  );
}
