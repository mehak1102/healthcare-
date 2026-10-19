import { Video } from 'lucide-react';
import { Link } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button-variants';
import { cn } from '@/lib/cn';
import { formatDateTime, type PatientAppointment } from './api';
import { VideoJoinLink } from './video-join-link';

/** Explains each step of an online visit and surfaces join links when the server allows them. */
export function OnlineVideoSection({ appointment }: { appointment: PatientAppointment }) {
  if (appointment.mode !== 'online') return null;

  const callPath = `/appointments/${appointment.id}/call`;

  if (appointment.status === 'pending_payment') {
    return (
      <Alert tone="info" title="Video consultation">
        Complete payment below to reserve this video slot. After that, the doctor may need to accept
        the booking before you can join the call.
      </Alert>
    );
  }

  if (appointment.status === 'pending_doctor') {
    return (
      <Alert tone="info" title="Waiting for the doctor to accept">
        Your video appointment is booked and paid. The doctor must accept it on their dashboard
        before the join button appears here. This page updates automatically when they accept.
      </Alert>
    );
  }

  if (appointment.status !== 'confirmed') return null;

  return (
    <section
      className="flex flex-col gap-3 rounded-[var(--radius-control)] border border-line bg-canvas p-4"
      aria-labelledby={`video-${appointment.id}`}
    >
      <h3 id={`video-${appointment.id}`} className="flex items-center gap-2 text-sm font-semibold">
        <Video className="size-4 text-coral-ink" aria-hidden="true" />
        Video consultation
      </h3>
      <p className="text-sm text-ink-muted">
        Scheduled for {formatDateTime(appointment.startsAt)} (India time). You can join from 5
        minutes before the start until the slot ends.
      </p>
      <VideoJoinLink appointment={appointment} to={callPath} />
      <Link
        to={callPath}
        className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }), 'self-start')}
      >
        Open video room
      </Link>
      <p className="text-xs text-ink-muted">
        On the next screen, click <strong>Join call</strong> and allow camera and microphone when
        your browser asks.
      </p>
    </section>
  );
}
