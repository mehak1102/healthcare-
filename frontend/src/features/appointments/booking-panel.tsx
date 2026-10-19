import { useMutation, useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { buttonVariants } from '@/components/ui/button-variants';
import { Skeleton } from '@/components/ui/skeleton';
import { hasPermission, useCurrentUser } from '@/features/auth/use-auth';
import {
  type ConsultationMode,
  doctorName,
  type DoctorPublicProfile,
  MODE_LABELS,
} from '@/features/doctors/api';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import { withNext } from '@/lib/safe-redirect';
import { appointmentsApi, formatDateTime, formatDay, formatTime, type Slot } from './api';
import { paymentErrorMessage, usePayment } from './use-payment';

function nextDate(date: string): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

export function BookingPanel({ doctor }: { doctor: DoctorPublicProfile }) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const [weeks, setWeeks] = useState<(string | null)[]>([null]);
  const from = weeks[weeks.length - 1] ?? null;
  const [chosenDay, setChosenDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [mode, setMode] = useState<ConsultationMode | null>(null);
  const [note, setNote] = useState('');
  const idempotencyKey = useRef<string | null>(null);

  const slots = useQuery({
    queryKey: ['doctors', doctor.slug, 'slots', from],
    queryFn: ({ signal }) => appointmentsApi.slots(doctor.slug, from, signal),
  });
  const pay = usePayment();
  const book = useMutation({
    mutationFn: () => {
      if (!slot) throw new Error('Choose a time first.');
      idempotencyKey.current ??= crypto.randomUUID();
      return appointmentsApi.book(
        {
          doctorSlug: doctor.slug,
          startsAt: slot.startsAt,
          mode: slot.mode,
          ...(note.trim() ? { patientNote: note.trim() } : {}),
        },
        idempotencyKey.current,
      );
    },
    onSuccess: async (appointment) => {
      idempotencyKey.current = null;
      let notice: string | null = null;
      if (appointment.checkout) {
        try {
          await pay.mutateAsync(appointment);
        } catch (error) {
          notice = paymentErrorMessage(error);
        }
      }
      navigate(`/appointments/${appointment.id}`, { state: notice ? { notice } : undefined });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'SLOT_UNAVAILABLE') {
        setSlot(null);
        idempotencyKey.current = null;
        void slots.refetch();
      }
    },
  });

  const videoOpen = slots.data?.videoBookingOpen ?? false;
  const offersVideo = doctor.consultationModes.includes('online');
  const offersBoth = offersVideo && videoOpen && doctor.consultationModes.includes('clinic');
  const days = (slots.data?.days ?? []).map((day) =>
    mode ? { ...day, slots: day.slots.filter((option) => option.mode === mode) } : day,
  );
  const selectedDay =
    days.find((day) => day.date === chosenDay) ?? days.find((day) => day.slots.length > 0) ?? null;
  const lastDay = days.at(-1)?.date;
  const canGoLater = !!lastDay && !!slots.data && lastDay < slots.data.bookableUntil;
  const busy = book.isPending || pay.isPending;
  const reason = slots.data?.unavailableReason ?? null;
  const nextAvailable = slots.data?.nextAvailableDate ?? null;
  const jumpTo =
    !mode && nextAvailable && lastDay && nextAvailable > lastDay ? nextAvailable : null;

  const choose = (next: Slot | null) => {
    setSlot(next);
    idempotencyKey.current = null;
  };

  if (doctor.consultationFeeInr === null) return null;

  if (reason === 'not_accepting') {
    return (
      <Alert tone="info" title="Not accepting new bookings">
        {doctorName(doctor.displayName)} is unavailable, busy or on leave, so new appointments are
        closed. Verification and availability are separate: a verified doctor can still be off duty.
      </Alert>
    );
  }

  if (reason === 'no_timetable') {
    return (
      <div className="flex flex-col gap-3">
        <Alert tone="info" title="No appointment times yet">
          {offersVideo && !videoOpen
            ? `${doctorName(doctor.displayName)} has no in-clinic times to book, and video consultations are switched off on Sukoon Health right now. Please check back soon.`
            : `${doctorName(doctor.displayName)} has not published their available times yet. Please check back soon.`}
        </Alert>
        {user && hasPermission(user, 'provider:schedule:manage-own') && (
          <Link
            to="/doctor/schedule"
            className="text-sm font-semibold text-coral-ink hover:underline"
          >
            Is this your profile? Set your timetable
          </Link>
        )}
      </div>
    );
  }

  const paymentsPaused = reason === 'payments_unavailable';
  const isAdmin = user?.roles.includes('platform_admin') || user?.roles.includes('super_admin');

  return (
    <div className="flex flex-col gap-4">
      {paymentsPaused && (
        <Alert tone="warning" title="Booking is paused">
          Online payment is not switched on yet, so paid appointments cannot be booked right now.
          {isAdmin && (
            <p className="mt-2">
              On this server, set <code className="text-xs">PAYMENT_PROVIDER=sandbox</code> for
              local testing, or add Razorpay test keys — see{' '}
              <code className="text-xs">backend/.env.example</code>. Restart the backend after
              changing <code className="text-xs">.env</code>.
            </p>
          )}
        </Alert>
      )}
      {slots.data && offersVideo && !videoOpen && (
        <Alert tone="info" title="Video consultations are not on this site yet">
          In-clinic times are below. Video hours on the doctor&apos;s timetable are hidden until
          LiveKit is configured on the server.
          {isAdmin && (
            <p className="mt-2">
              Add <code className="text-xs">VIDEO_PROVIDER=livekit</code> and your LiveKit URL and
              API keys in <code className="text-xs">backend/.env</code>, then restart the backend.
              See <code className="text-xs">backend/.env.example</code>.
            </p>
          )}
        </Alert>
      )}

      {offersBoth && (
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Type of consultation">
          {(
            [
              [null, 'All'],
              ['clinic', MODE_LABELS.clinic],
              ['online', MODE_LABELS.online],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value);
                setChosenDay(null);
                choose(null);
              }}
              className={cn(
                'rounded-[var(--radius-control)] border px-2 py-1.5 text-xs transition-colors',
                mode === value
                  ? 'border-coral-ink bg-peach/60 font-semibold'
                  : 'border-line hover:border-rose',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Earlier dates"
          disabled={weeks.length === 1 || slots.isFetching}
          onClick={() => {
            setWeeks((list) => list.slice(0, -1));
            setChosenDay(null);
            choose(null);
          }}
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <p className="text-sm font-semibold">Choose a day</p>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Later dates"
          disabled={!canGoLater || slots.isFetching}
          onClick={() => {
            if (!lastDay) return;
            setWeeks((list) => [...list, nextDate(lastDay)]);
            setChosenDay(null);
            choose(null);
          }}
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>

      {slots.isPending && <Skeleton className="h-24" />}
      {slots.isError && <Alert tone="error">We could not load available times.</Alert>}

      {slots.data && (
        <>
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="group" aria-label="Days">
            {days.map((day) => (
              <button
                key={day.date}
                type="button"
                disabled={day.slots.length === 0}
                aria-pressed={selectedDay?.date === day.date}
                onClick={() => {
                  setChosenDay(day.date);
                  choose(null);
                }}
                className={cn(
                  'rounded-[var(--radius-control)] border px-1 py-2 text-xs leading-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40',
                  selectedDay?.date === day.date
                    ? 'border-coral-ink bg-peach/60 font-semibold'
                    : 'border-line hover:border-rose',
                )}
              >
                {formatDay(day.date)}
                <span className="block text-[0.7rem] text-ink-muted">
                  {day.slots.length} {day.slots.length === 1 ? 'slot' : 'slots'}
                </span>
              </button>
            ))}
          </div>

          {selectedDay ? (
            <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Times">
              {selectedDay.slots.map((option) => (
                <button
                  key={option.startsAt}
                  type="button"
                  aria-pressed={slot?.startsAt === option.startsAt}
                  disabled={paymentsPaused}
                  onClick={() => choose(option)}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-2 py-2 text-sm transition-colors',
                    slot?.startsAt === option.startsAt
                      ? 'border-coral-ink bg-coral font-semibold'
                      : 'border-line hover:border-rose',
                  )}
                >
                  {formatTime(option.startsAt)}
                  {offersBoth && !mode && (
                    <span className="block text-[0.7rem] font-normal text-ink-muted">
                      {option.mode === 'online' ? 'Video' : 'Clinic'}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ) : jumpTo ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
              <span>No free times in these dates.</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setWeeks((list) => [...list, jumpTo]);
                  setChosenDay(jumpTo);
                  choose(null);
                }}
              >
                Next available: {formatDay(jumpTo)}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-ink-muted">
              {nextAvailable
                ? 'No free times in these dates. Try other dates.'
                : 'All times in the next 30 days are taken. Please check back later.'}
            </p>
          )}
          <p className="text-xs text-ink-muted">Times are India time (IST).</p>
        </>
      )}

      {!paymentsPaused && !user ? (
        <Link
          to={withNext('/login', `/doctors/${doctor.slug}`)}
          className={buttonVariants({ variant: 'primary' })}
        >
          Sign in to book
        </Link>
      ) : !hasPermission(user, 'appointments:self:book') ? (
        <Alert tone="info">Sign in with a patient account to book appointments.</Alert>
      ) : (
        slot && (
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              book.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <label htmlFor="patient-note" className="text-sm font-semibold">
                Reason for visit <span className="font-normal text-ink-muted">(optional)</span>
              </label>
              <textarea
                id="patient-note"
                rows={2}
                maxLength={500}
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  idempotencyKey.current = null;
                }}
                className="rounded-[var(--radius-control)] border border-line bg-surface px-3 py-2 text-sm hover:border-rose focus-visible:border-coral-ink"
              />
              <p className="text-xs text-ink-muted">Only you and the doctor can see this.</p>
            </div>
            {book.isError && (
              <Alert tone="error">
                {book.error instanceof ApiError
                  ? book.error.message
                  : 'We could not book this time. Please try again.'}
              </Alert>
            )}
            <Button type="submit" loading={busy}>
              {doctor.consultationFeeInr > 0
                ? `Book and pay ₹${new Intl.NumberFormat('en-IN').format(doctor.consultationFeeInr)}`
                : 'Book free consultation'}
            </Button>
            <p className="text-xs text-ink-muted">
              {formatDateTime(slot.startsAt)}, {MODE_LABELS[slot.mode].toLowerCase()}. You can
              cancel any time before it starts for a full refund.
              {doctor.consultationFeeInr > 0 && (
                <> You will pay securely with Razorpay (UPI, cards, netbanking and wallets).</>
              )}
            </p>
          </form>
        )
      )}
    </div>
  );
}
