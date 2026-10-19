import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/page-header';
import { PageLoading } from '@/components/layout/page-loading';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  doctorsApi,
  MODE_LABELS,
  MY_PROFILE_KEY,
  type ConsultationMode,
} from '@/features/doctors/api';
import { ApiError } from '@/lib/api-client';
import { usePageTitle } from '@/lib/use-page-title';
import {
  appointmentsApi,
  DAY_NAMES,
  formatDay,
  istCalendarDate,
  MY_SCHEDULE_KEY,
  SLOT_LENGTHS,
  type OneOffBlock,
  type Schedule,
  type WeeklyBlock,
} from './api';

const controlClass =
  'h-10 rounded-[var(--radius-control)] border border-line bg-surface px-2.5 text-sm hover:border-rose focus-visible:border-coral-ink';

export function DoctorSchedulePage() {
  usePageTitle('Your timetable');
  const schedule = useQuery({ queryKey: MY_SCHEDULE_KEY, queryFn: appointmentsApi.mySchedule });
  const profile = useQuery({ queryKey: MY_PROFILE_KEY, queryFn: doctorsApi.myProfile });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="For doctors"
        title="Your timetable"
        description="Set the hours patients can book each week. All times are India time (IST)."
      />
      <div className="mt-8">
        {(schedule.isPending || profile.isPending) && <PageLoading />}
        {(schedule.isError || profile.isError) && (
          <Alert tone="error">
            {profile.error instanceof ApiError && profile.error.code === 'PROFILE_NOT_FOUND'
              ? profile.error.message
              : 'We could not load your timetable. Please refresh the page.'}
          </Alert>
        )}
        {schedule.data && profile.data && (
          <ScheduleEditor
            schedule={schedule.data}
            modes={profile.data.consultationModes}
            published={profile.data.published}
            available={profile.data.availabilityStatus === 'available'}
          />
        )}
      </div>
    </div>
  );
}

function ScheduleEditor({
  schedule,
  modes,
  published,
  available,
}: {
  schedule: Schedule;
  modes: ConsultationMode[];
  published: boolean;
  available: boolean;
}) {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<WeeklyBlock[]>(schedule.rules);
  const [extraBlocks, setExtraBlocks] = useState<OneOffBlock[]>(schedule.extraBlocks ?? []);
  const [daysOff, setDaysOff] = useState<string[]>(schedule.daysOff);
  const [newDayOff, setNewDayOff] = useState('');
  const [saved, setSaved] = useState(false);
  const save = useMutation({
    mutationFn: () => appointmentsApi.saveSchedule({ rules, extraBlocks, daysOff }),
    onSuccess: (result) => {
      queryClient.setQueryData(MY_SCHEDULE_KEY, result);
      setRules(result.rules);
      setExtraBlocks(result.extraBlocks ?? []);
      setDaysOff(result.daysOff);
      setSaved(true);
    },
  });

  const update = (index: number, patch: Partial<WeeklyBlock>) => {
    setSaved(false);
    setRules((list) => list.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)));
  };
  const addDayOff = (day: string) => {
    if (!day || daysOff.includes(day)) return;
    setSaved(false);
    setDaysOff((list) => [...list, day].sort());
    setNewDayOff('');
  };
  const updateExtra = (index: number, patch: Partial<OneOffBlock>) => {
    setSaved(false);
    setExtraBlocks((list) => list.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };
  const defaultMode: ConsultationMode = modes.includes('clinic')
    ? 'clinic'
    : (modes[0] ?? 'clinic');

  if (modes.length === 0) {
    return (
      <Alert tone="info">
        Choose how patients can consult you on{' '}
        <Link to="/doctor/profile" className="font-semibold underline">
          your profile
        </Link>{' '}
        before setting your timetable.
      </Alert>
    );
  }

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      {!published && (
        <Alert tone="warning">
          Your profile is not published, so patients cannot book you yet.{' '}
          <Link to="/doctor/profile" className="font-semibold underline">
            Publish your profile
          </Link>
          .
        </Alert>
      )}
      {published && !available && (
        <Alert tone="warning" title="You are not taking new bookings">
          Your availability is switched off, so patients see no times even though your hours are
          saved.{' '}
          <Link to="/doctor" className="font-semibold underline">
            Set yourself to Available on your doctor dashboard
          </Link>
          .
        </Alert>
      )}
      {!schedule.onlineBookingOpen && modes.includes('online') && (
        <Alert tone="info">
          Video consultations are switched off on this site right now. You can still add online
          hours; patients can book them once video calls are switched on.
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Weekly hours</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {rules.length === 0 && (
            <p className="text-sm text-ink-muted">
              No hours yet. Add a block to start taking bookings.
            </p>
          )}
          {rules.map((rule, index) => (
            <fieldset
              key={index}
              className="grid grid-cols-2 items-end gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr_auto]"
            >
              <legend className="sr-only">Block {index + 1}</legend>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Day
                <select
                  className={controlClass}
                  value={rule.day}
                  onChange={(event) => update(index, { day: Number(event.target.value) })}
                >
                  {DAY_NAMES.map((name, day) => (
                    <option key={name} value={day}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                From
                <input
                  type="time"
                  step={300}
                  className={controlClass}
                  value={rule.start}
                  onChange={(event) => update(index, { start: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                To
                <input
                  type="time"
                  step={300}
                  className={controlClass}
                  value={rule.end}
                  onChange={(event) => update(index, { end: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Each visit
                <select
                  className={controlClass}
                  value={rule.slotMinutes}
                  onChange={(event) => update(index, { slotMinutes: Number(event.target.value) })}
                >
                  {SLOT_LENGTHS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Type
                <select
                  className={controlClass}
                  value={rule.mode}
                  onChange={(event) =>
                    update(index, { mode: event.target.value as ConsultationMode })
                  }
                >
                  {modes.map((mode) => (
                    <option key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove block ${index + 1}`}
                onClick={() => {
                  setSaved(false);
                  setRules((list) => list.filter((_, i) => i !== index));
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="sm:self-start"
            onClick={() => {
              setSaved(false);
              setRules((list) => [
                ...list,
                { day: 1, start: '10:00', end: '13:00', slotMinutes: 15, mode: defaultMode },
              ]);
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Add hours
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extra hours on a date</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            Add one-off availability outside your weekly pattern (for example a Saturday clinic).
            Does not apply on a date listed under Days off.
          </p>
          {extraBlocks.map((block, index) => (
            <fieldset
              key={`${block.date}-${index}`}
              className="grid grid-cols-2 items-end gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-[1.3fr_1fr_1fr_1fr_1.2fr_auto]"
            >
              <legend className="sr-only">Extra block {index + 1}</legend>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Date (IST)
                <input
                  type="date"
                  className={controlClass}
                  value={block.date}
                  onChange={(event) => updateExtra(index, { date: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                From
                <input
                  type="time"
                  step={300}
                  className={controlClass}
                  value={block.start}
                  onChange={(event) => updateExtra(index, { start: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                To
                <input
                  type="time"
                  step={300}
                  className={controlClass}
                  value={block.end}
                  onChange={(event) => updateExtra(index, { end: event.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Each visit
                <select
                  className={controlClass}
                  value={block.slotMinutes}
                  onChange={(event) =>
                    updateExtra(index, { slotMinutes: Number(event.target.value) })
                  }
                >
                  {SLOT_LENGTHS.map((minutes) => (
                    <option key={minutes} value={minutes}>
                      {minutes} min
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold">
                Type
                <select
                  className={controlClass}
                  value={block.mode}
                  onChange={(event) =>
                    updateExtra(index, { mode: event.target.value as ConsultationMode })
                  }
                >
                  {modes.map((mode) => (
                    <option key={mode} value={mode}>
                      {MODE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={`Remove extra block ${index + 1}`}
                onClick={() => {
                  setSaved(false);
                  setExtraBlocks((list) => list.filter((_, i) => i !== index));
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </fieldset>
          ))}
          <Button
            type="button"
            variant="secondary"
            className="sm:self-start"
            onClick={() => {
              setSaved(false);
              setExtraBlocks((list) => [
                ...list,
                {
                  date: istCalendarDate(7),
                  start: '10:00',
                  end: '13:00',
                  slotMinutes: 15,
                  mode: defaultMode,
                },
              ]);
            }}
          >
            <Plus className="size-4" aria-hidden="true" /> Add extra hours
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Days off</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <p className="text-sm text-ink-muted">
            No new bookings are offered on these dates. Existing appointments are not cancelled
            automatically.
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold">
              Date
              <input
                type="date"
                className={controlClass}
                value={newDayOff}
                onChange={(event) => setNewDayOff(event.target.value)}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              disabled={!newDayOff || daysOff.includes(newDayOff)}
              onClick={() => addDayOff(newDayOff)}
            >
              Add day off
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={daysOff.includes(istCalendarDate(0))}
              onClick={() => addDayOff(istCalendarDate(0))}
            >
              Today (IST)
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={daysOff.includes(istCalendarDate(1))}
              onClick={() => addDayOff(istCalendarDate(1))}
            >
              Tomorrow (IST)
            </Button>
          </div>
          {daysOff.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {daysOff.map((day) => (
                <li
                  key={day}
                  className="flex items-center gap-1 rounded-full bg-sand py-1 pr-1 pl-3 text-sm"
                >
                  {formatDay(day)}
                  <button
                    type="button"
                    aria-label={`Remove ${formatDay(day)}`}
                    className="grid size-6 place-items-center rounded-full hover:bg-beige/60"
                    onClick={() => {
                      setSaved(false);
                      setDaysOff((list) => list.filter((d) => d !== day));
                    }}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {saved && <Alert tone="success">Your timetable has been saved.</Alert>}
      {save.isError && (
        <Alert tone="error" title="Your timetable was not saved">
          {save.error instanceof ApiError && save.error.details.length > 0 ? (
            <ul className="list-disc pl-5">
              {save.error.details.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            'Please try again.'
          )}
        </Alert>
      )}
      <Button type="submit" size="lg" loading={save.isPending} className="sm:self-start">
        Save timetable
      </Button>
    </form>
  );
}
