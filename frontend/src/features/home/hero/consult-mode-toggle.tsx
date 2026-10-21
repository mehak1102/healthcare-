import { cn } from '@/lib/cn';
import type { ConsultMode } from './hero-copy';
import { ClinicIcon, VideoIcon } from './hero-icons';

export function ConsultModeToggle({
  mode,
  clinicLabel,
  videoLabel,
  onChange,
}: {
  mode: ConsultMode;
  clinicLabel: string;
  videoLabel: string;
  onChange: (mode: ConsultMode) => void;
}) {
  return (
    <div
      className="hero-glass mx-auto grid w-full max-w-[420px] grid-cols-2 gap-1 rounded-2xl p-1.5 sm:inline-flex sm:w-auto"
      role="group"
      aria-label="Consultation type"
    >
      {(
        [
          ['clinic', clinicLabel, ClinicIcon],
          ['video', videoLabel, VideoIcon],
        ] as const
      ).map(([value, label, Icon]) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(value)}
            className={cn(
              'inline-flex h-12 items-center justify-center gap-2 rounded-[14px] px-5 text-[15px] font-semibold',
              active
                ? 'bg-[var(--hero-ink)] text-white'
                : 'text-[var(--hero-body)] hover:text-[var(--hero-ink)]',
            )}
          >
            <Icon className="size-[18px]" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
