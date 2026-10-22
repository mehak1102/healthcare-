import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type CSSProperties, type PointerEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { accountApi, type SessionSummary } from '@/features/account/api';
import { describeDevice } from '@/features/account/describe-device';
import { formatTime, istCalendarDate, type Slot } from '@/features/appointments/api';
import type { DashboardAppointment } from '@/features/dashboards/api';
import type { CurrentUser } from '@/features/auth/api';
import {
  doctorName,
  type DoctorCard,
  type DoctorPublicProfile,
} from '@/features/doctors/api';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import type { ConsultMode } from './hero-copy';
import { initialsFromName } from './hero-data';
import { CheckIcon, LockIcon } from './hero-icons';

type Copy = ReturnType<typeof import('./hero-copy').heroCopy>;

function glassCard(className: string, children: ReactNode, style?: CSSProperties) {
  return (
    <div className={cn('hero-glass rounded-[22px] p-4', className)} style={style}>
      {children}
    </div>
  );
}

function DoctorCardPanel({
  doctor,
  profile,
  copy,
}: {
  doctor: DoctorCard;
  profile?: DoctorPublicProfile;
  copy: Copy;
}) {
  const checked = Boolean(profile?.registrationCheckedAt);
  const address = [profile?.clinicName ?? doctor.clinicName, doctor.locality, doctor.city]
    .filter(Boolean)
    .join(', ');
  const rows = [
    {
      label: profile?.registrationCouncil
        ? `${profile.registrationCouncil} · ${profile.registrationYear}`
        : `Registration · ${doctor.registrationYear}`,
      ok: checked,
    },
    { label: doctor.qualification || profile?.qualification, ok: Boolean(doctor.qualification) },
    { label: address || doctor.city, ok: Boolean(address || doctor.city) },
  ].filter((row) => row.label);

  return glassCard(
    'hero-pop hero-bob w-full max-w-[300px]',
    <>
      <Link to={`/doctors/${doctor.slug}`} className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-[#FFE9DE] text-sm font-semibold text-[#B4532A]">
          {initialsFromName(doctor.displayName)}
        </span>
        <div>
          <p className="flex items-center gap-1.5 text-[15px] font-semibold">
            {doctorName(doctor.displayName)}
            {checked ? (
              <span className="grid size-4 place-items-center rounded-full bg-[var(--hero-indigo)] text-white">
                <CheckIcon className="size-2.5" />
              </span>
            ) : null}
          </p>
          <p className="text-[12.5px] text-[var(--hero-muted)]">{doctor.specialty}</p>
        </div>
      </Link>
      <ul className="mt-4 space-y-2 text-[12.5px] text-[var(--hero-body)]">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate">{row.label}</span>
            <span className="shrink-0 font-semibold text-[var(--hero-success)]">
              {row.ok ? copy.checked : copy.pendingCheck}
            </span>
          </li>
        ))}
      </ul>
    </>,
    { animationDelay: '1s' },
  );
}

function SlotPicker({
  slots,
  selected,
  onSelect,
  copy,
}: {
  slots: Slot[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  copy: Copy;
}) {
  if (!slots.length) {
    return glassCard(
      'hero-pop hero-bob mt-4 ml-10 w-full max-w-[260px] max-sm:ml-0 text-[13px] text-[var(--hero-muted)]',
      copy.noSlots,
      { animationDelay: '1.15s' },
    );
  }
  const day = slots[0] ? istCalendarDate() : '';
  const sameDay = slots.every((slot) => slot.startsAt.slice(0, 10) === slots[0].startsAt.slice(0, 10));
  return glassCard(
    'hero-pop hero-bob mt-4 ml-10 w-full max-w-[260px] max-sm:ml-0',
    <>
      <p className="mb-3 text-[13px] font-semibold text-[var(--hero-dark)]">
        {copy.pickTime}
        {sameDay ? ` · ${slots[0].startsAt.slice(0, 10) === day ? copy.today : slots[0].startsAt.slice(0, 10)}` : ''}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {slots.map((slot) => {
          const active = selected?.startsAt === slot.startsAt;
          return (
            <button
              key={slot.startsAt}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(slot)}
              className={cn(
                'h-11 rounded-xl text-[13px] font-semibold',
                active
                  ? 'bg-[var(--hero-ink)] text-white'
                  : 'border border-[var(--hero-border)] bg-white text-[var(--hero-dark)]',
              )}
            >
              {formatTime(slot.startsAt)}
            </button>
          );
        })}
      </div>
    </>,
    { animationDelay: '1.15s' },
  );
}

function PhoneMockup({
  copy,
  user,
  doctor,
  slot,
  upcoming,
  specialties,
  mode,
}: {
  copy: Copy;
  user: CurrentUser | null | undefined;
  doctor?: DoctorCard;
  slot: Slot | null;
  upcoming: DashboardAppointment | null;
  specialties: string[];
  mode: ConsultMode;
}) {
  const first = user?.fullName.split(/\s+/)[0] ?? 'there';
  const time = upcoming ? formatTime(upcoming.startsAt) : slot ? formatTime(slot.startsAt) : '—';
  const line = upcoming
    ? `${upcoming.doctorName} · ${upcoming.mode === 'online' ? 'Video call' : 'In-clinic'}`
    : doctor
      ? `${doctorName(doctor.displayName)} · ${mode === 'video' ? 'Video call' : 'In-clinic'}`
      : copy.noDoctors;
  const tints = ['#EEEDFF', '#FFE9DE', '#E3F6EC', '#CDEBFF'];

  return (
    <div className="hero-phone-in mx-auto h-[640px] w-[312px] rounded-[56px] bg-[var(--hero-ink)] p-[11px] shadow-[0_40px_80px_-32px_rgb(14_18_34/0.55)]">
      <div className="relative h-full overflow-hidden rounded-[46px] bg-[#F7F8FC]">
        <div className="absolute top-2 left-1/2 h-[22px] w-[108px] -translate-x-1/2 rounded-full bg-[var(--hero-ink)]" />
        <div className="px-5 pt-8">
          <div className="flex items-center justify-between text-[12px] text-[var(--hero-muted)]">
            <span>
              {new Intl.DateTimeFormat('en-IN', {
                hour: 'numeric',
                minute: '2-digit',
                timeZone: 'Asia/Kolkata',
              }).format(new Date())}
            </span>
          </div>
          <div className="mt-4 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[var(--hero-muted)]">{copy.greeting}</p>
              <p className="text-[22px] font-semibold tracking-tight">{first}</p>
            </div>
            <span className="grid size-9 place-items-center rounded-full bg-[var(--hero-tint)] text-sm font-semibold text-[var(--hero-indigo-dark)]">
              {initialsFromName(user?.fullName ?? 'G')}
            </span>
          </div>
          <Link
            to="/doctors"
            className="mt-4 flex h-11 items-center gap-2 rounded-full bg-white px-3 text-[13px] text-[var(--hero-placeholder)] shadow-sm"
          >
            {copy.searchPhone}
          </Link>
          <div
            className="mt-4 rounded-[22px] p-4 text-white"
            style={{
              background: 'linear-gradient(140deg, #5B5EF2 0%, #7B6CF6 55%, #9D8CF8 100%)',
            }}
          >
            <p className="text-[12px] opacity-90">
              {copy.upcoming}
              {upcoming ? '' : ` · ${copy.today}`}
            </p>
            <p className="mt-1 text-[30px] leading-none font-semibold">{time}</p>
            <p className="mt-3 line-clamp-2 text-[12.5px]">{line}</p>
          </div>
          <p className="mt-5 text-[13px] font-semibold">{copy.specialties}</p>
          <div className="mt-2 grid grid-cols-4 gap-2 text-center text-[10px] text-[var(--hero-muted)]">
            {specialties.slice(0, 4).map((label, index) => (
              <Link
                key={label}
                to={`/doctors?specialty=${encodeURIComponent(label)}&takingBookings=1`}
                className="flex flex-col items-center gap-1.5"
              >
                <span
                  className="grid size-12 place-items-center rounded-2xl text-[var(--hero-indigo-dark)]"
                  style={{ background: tints[index] }}
                >
                  <span className="size-4 rounded-full bg-[var(--hero-indigo)]/20" />
                </span>
                <span className="line-clamp-2">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfirmedToast({
  copy,
  upcoming,
  doctor,
  slot,
  mode,
}: {
  copy: Copy;
  upcoming: DashboardAppointment | null;
  doctor?: DoctorCard;
  slot: Slot | null;
  mode: ConsultMode;
}) {
  if (upcoming) {
    return glassCard(
      'hero-pop hero-bob w-full max-w-[300px] -ml-5 max-sm:ml-0',
      <Link to={`/appointments/${upcoming.id}`} className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--hero-success-bg)] text-[var(--hero-success-icon)]">
          <CheckIcon className="size-5" />
        </span>
        <div>
          <p className="text-[14.5px] font-semibold">
            {upcoming.status === 'confirmed' ? 'Appointment confirmed' : upcoming.doctorName}
          </p>
          <p className="mt-0.5 text-[12.5px] text-[var(--hero-muted)]">
            {formatTime(upcoming.startsAt)} · {upcoming.specialty}
          </p>
        </div>
      </Link>,
      { animationDelay: '1.3s' },
    );
  }

  if (!doctor) {
    return glassCard(
      'hero-pop hero-bob w-full max-w-[300px] -ml-5 max-sm:ml-0 text-[13px] text-[var(--hero-muted)]',
      copy.noDoctors,
      { animationDelay: '1.3s' },
    );
  }

  return glassCard(
    'hero-pop hero-bob w-full max-w-[300px] -ml-5 max-sm:ml-0',
    <Link to={`/doctors/${doctor.slug}`} className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--hero-success-bg)] text-[var(--hero-success-icon)]">
        <CheckIcon className="size-5" />
      </span>
      <div>
        <p className="text-[14.5px] font-semibold">{copy.bookThis}</p>
        <p className="mt-0.5 text-[12.5px] text-[var(--hero-muted)]">
          {doctorName(doctor.displayName)}
          {slot ? ` · ${formatTime(slot.startsAt)}` : ''}
          {` · ${mode === 'video' ? 'Video' : 'In-clinic'}`}
        </p>
      </div>
    </Link>,
    { animationDelay: '1.3s' },
  );
}

function DevicesCard({
  copy,
  user,
  sessions,
  recordsMessage,
}: {
  copy: Copy;
  user: CurrentUser | null | undefined;
  sessions: SessionSummary[];
  recordsMessage?: string;
}) {
  const queryClient = useQueryClient();
  const revoke = useMutation({
    mutationFn: (id: string) => accountApi.revokeSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['auth', 'sessions'] }),
  });

  if (!user) {
    return glassCard(
      'hero-pop hero-bob mt-5 ml-6 w-full max-w-[300px] max-sm:ml-0',
      <>
        <p className="mb-2 flex items-center gap-2 text-[14.5px] font-semibold">
          <span className="grid size-8 place-items-center rounded-lg bg-[var(--hero-tint)] text-[var(--hero-indigo)]">
            <LockIcon className="size-4" />
          </span>
          {copy.devicesTitle}
        </p>
        <p className="text-[12.5px] text-[var(--hero-muted)]">{copy.signInRecords}</p>
        <Link to="/login" className="mt-3 inline-block text-[13px] font-semibold text-[var(--hero-indigo-dark)]">
          {copy.signIn} →
        </Link>
      </>,
      { animationDelay: '1.45s' },
    );
  }

  return glassCard(
    'hero-pop hero-bob mt-5 ml-6 w-full max-w-[300px] max-sm:ml-0',
    <>
      <p className="mb-3 flex items-center gap-2 text-[14.5px] font-semibold">
        <span className="grid size-8 place-items-center rounded-lg bg-[var(--hero-tint)] text-[var(--hero-indigo)]">
          <LockIcon className="size-4" />
        </span>
        {copy.devicesTitle}
      </p>
      <ul className="space-y-3">
        {sessions.slice(0, 3).map((session) => {
          const device = describeDevice(session.userAgent);
          return (
            <li key={session.id} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0 truncate">
                {session.current ? copy.thisDevice : device.label}
              </span>
              {session.current ? (
                <span className="h-[26px] w-11 shrink-0 rounded-full bg-[var(--hero-indigo)]" />
              ) : (
                <button
                  type="button"
                  aria-label={copy.revokeDevice}
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(session.id)}
                  className="relative h-[26px] w-11 shrink-0 rounded-full bg-[var(--hero-switch-off)]"
                >
                  <span className="absolute top-[3px] left-[3px] size-5 rounded-full bg-white shadow-sm" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-[11.5px] text-[var(--hero-muted)]">{recordsMessage ?? copy.recordsSoon}</p>
    </>,
    { animationDelay: '1.45s' },
  );
}

function MobileStack(props: {
  copy: Copy;
  doctor?: DoctorCard;
  profile?: DoctorPublicProfile;
  slots: Slot[];
  selected: Slot | null;
  onSelect: (slot: Slot) => void;
  upcoming: DashboardAppointment | null;
  mode: ConsultMode;
  user: CurrentUser | null | undefined;
  sessions: SessionSummary[];
  recordsMessage?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ConfirmedToast
        copy={props.copy}
        upcoming={props.upcoming}
        doctor={props.doctor}
        slot={props.selected}
        mode={props.mode}
      />
      {props.doctor ? (
        <DoctorCardPanel doctor={props.doctor} profile={props.profile} copy={props.copy} />
      ) : (
        glassCard('', props.copy.noDoctors)
      )}
      <SlotPicker slots={props.slots} selected={props.selected} onSelect={props.onSelect} copy={props.copy} />
      <DevicesCard
        copy={props.copy}
        user={props.user}
        sessions={props.sessions}
        recordsMessage={props.recordsMessage}
      />
    </div>
  );
}

export function AppShowcase({
  copy,
  mode,
  user,
  doctor,
  profile,
  slots,
  specialties,
  upcoming,
  sessions,
  recordsMessage,
  selectedSlot,
  onSelectSlot,
}: {
  copy: Copy;
  mode: ConsultMode;
  user: CurrentUser | null | undefined;
  doctor?: DoctorCard;
  profile?: DoctorPublicProfile;
  slots: Slot[];
  specialties: string[];
  upcoming: DashboardAppointment | null;
  sessions: SessionSummary[];
  recordsMessage?: string;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const [shift, setShift] = useState({ x: 0, y: 0 });
  const selected = selectedSlot ?? slots[0] ?? null;

  const onMove = (event: PointerEvent<HTMLDivElement>) => {
    if (reduced || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    requestAnimationFrame(() => setShift({ x, y }));
  };

  const left = reduced
    ? undefined
    : { transform: `translate(${shift.x * -14}px, ${shift.y * -10}px)`, transition: 'transform .55s ease' };
  const center = reduced
    ? undefined
    : {
        transform: `translate(${shift.x * 5}px, ${shift.y * 5}px) rotateY(${shift.x * 3}deg)`,
        transition: 'transform .55s ease',
      };
  const right = reduced
    ? undefined
    : { transform: `translate(${shift.x * 14}px, ${shift.y * 10}px)`, transition: 'transform .55s ease' };

  return (
    <div
      className="mx-auto mt-6 w-full max-w-[1180px] px-4 sm:px-6"
      onPointerMove={onMove}
      onPointerLeave={() => setShift({ x: 0, y: 0 })}
    >
      <div className="hidden items-start justify-center gap-6 lg:flex">
        <div className="w-[300px] pt-6" style={left}>
          {doctor ? (
            <DoctorCardPanel doctor={doctor} profile={profile} copy={copy} />
          ) : (
            glassCard('w-full max-w-[300px] text-[13px] text-[var(--hero-muted)]', copy.noDoctors)
          )}
          {doctor ? (
            <SlotPicker slots={slots} selected={selected} onSelect={onSelectSlot} copy={copy} />
          ) : null}
        </div>
        <div style={center}>
          <PhoneMockup
            copy={copy}
            user={user}
            doctor={doctor}
            slot={selected}
            upcoming={upcoming}
            specialties={specialties}
            mode={mode}
          />
        </div>
        <div className="w-[300px] pt-1" style={right}>
          <ConfirmedToast
            copy={copy}
            upcoming={upcoming}
            doctor={doctor}
            slot={selected}
            mode={mode}
          />
          <DevicesCard
            copy={copy}
            user={user}
            sessions={sessions}
            recordsMessage={recordsMessage}
          />
        </div>
      </div>
      <div className="lg:hidden">
        <MobileStack
          copy={copy}
          doctor={doctor}
          profile={profile}
          slots={slots}
          selected={selected}
          onSelect={onSelectSlot}
          upcoming={upcoming}
          mode={mode}
          user={user}
          sessions={sessions}
        />
      </div>
    </div>
  );
}
