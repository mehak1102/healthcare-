import { Video } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/cn';
import { formatDateTime } from './api';

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/**
 * "Join video call" once the call is open, otherwise when it opens. Renders nothing for in-clinic,
 * inactive or finished appointments. The server enforces the same window.
 */
export function VideoJoinLink({
  appointment,
  to,
}: {
  appointment: { videoOpensAt: string | null; endsAt: string };
  to: string;
}) {
  const now = useNow(15_000);
  if (!appointment.videoOpensAt || now >= new Date(appointment.endsAt).getTime()) return null;
  if (now < new Date(appointment.videoOpensAt).getTime()) {
    return (
      <p className="text-sm text-ink-muted">
        The video call opens at {formatDateTime(appointment.videoOpensAt)}, 5 minutes before the
        start.
      </p>
    );
  }
  return (
    <Link to={to} className={cn(buttonVariants({ variant: 'primary' }), 'self-start')}>
      <Video className="size-4" aria-hidden="true" />
      Join video call
    </Link>
  );
}
