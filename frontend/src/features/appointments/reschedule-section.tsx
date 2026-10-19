import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { cn } from '@/lib/cn';
import {
  appointmentsApi,
  formatDateTime,
  formatTime,
  type PatientAppointment,
  type Slot,
} from './api';

export function RescheduleSection({ appointment }: { appointment: PatientAppointment }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<Slot | null>(null);
  const slots = useQuery({
    queryKey: ['doctors', appointment.doctor.slug, 'slots', 'reschedule'],
    queryFn: ({ signal }) => appointmentsApi.slots(appointment.doctor.slug, null, signal),
    enabled: open,
  });
  const reschedule = useMutation({
    mutationFn: () => {
      if (!chosen) throw new Error('Choose a time first.');
      return appointmentsApi.reschedule(appointment.id, chosen.startsAt);
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['appointments', 'detail', appointment.id], updated);
      void queryClient.invalidateQueries({ queryKey: ['appointments', 'mine'] });
      setOpen(false);
      setChosen(null);
    },
  });

  if (appointment.status !== 'confirmed' || !appointment.canCancel) return null;

  const options =
    slots.data?.days.flatMap((day) =>
      day.slots.filter(
        (slot) => slot.mode === appointment.mode && slot.startsAt !== appointment.startsAt,
      ),
    ) ?? [];

  return (
    <div className="border-t border-line pt-4">
      {!open ? (
        <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
          Change time
        </Button>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Pick another {appointment.mode === 'online' ? 'video' : 'in-clinic'} time with{' '}
            {appointment.doctor.displayName}. Your payment stays as it is.
          </p>
          {slots.isPending && <p className="text-sm text-ink-muted">Loading times…</p>}
          {slots.isError && <Alert tone="error">We could not load available times.</Alert>}
          {slots.data && options.length === 0 && (
            <Alert tone="info">No other times are free right now. Try again later.</Alert>
          )}
          {options.length > 0 && (
            <div className="grid max-h-48 grid-cols-3 gap-1.5 overflow-y-auto" role="group">
              {options.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  aria-pressed={chosen?.startsAt === slot.startsAt}
                  onClick={() => setChosen(slot)}
                  className={cn(
                    'rounded-[var(--radius-control)] border px-2 py-2 text-sm transition-colors',
                    chosen?.startsAt === slot.startsAt
                      ? 'border-coral-ink bg-coral font-semibold'
                      : 'border-line hover:border-rose',
                  )}
                >
                  {formatTime(slot.startsAt)}
                </button>
              ))}
            </div>
          )}
          {reschedule.isError && (
            <Alert tone="error">
              {reschedule.error instanceof ApiError
                ? reschedule.error.message
                : 'We could not change this time. Please try again.'}
            </Alert>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              loading={reschedule.isPending}
              disabled={!chosen}
              onClick={() => reschedule.mutate()}
            >
              Confirm new time
            </Button>
            <Button
              variant="ghost"
              disabled={reschedule.isPending}
              onClick={() => {
                setOpen(false);
                setChosen(null);
              }}
            >
              Keep current time
            </Button>
          </div>
          {chosen && (
            <p className="text-xs text-ink-muted">
              New time: {formatDateTime(chosen.startsAt)} (India time).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
