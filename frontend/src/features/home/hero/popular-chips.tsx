import { Link } from 'react-router';
import { HelpIcon } from './hero-icons';

export function PopularChips({
  specialties,
  popularLabel,
  help,
  helpLink,
  onPick,
}: {
  specialties: string[];
  popularLabel: string;
  help: string;
  helpLink: string;
  onPick: (value: string) => void;
}) {
  if (!specialties.length) return null;

  return (
    <div className="mx-auto flex w-full max-w-[800px] flex-col items-center gap-4">
      <div className="flex w-full items-center gap-3 max-sm:flex-col max-sm:items-stretch sm:justify-center">
        <p className="shrink-0 text-[14px] text-[var(--hero-muted)]">{popularLabel}</p>
        <div className="hero-chips flex gap-2 overflow-x-auto max-sm:pb-1">
          {specialties.slice(0, 6).map((label) => (
            <button
              key={label}
              type="button"
              onClick={() => onPick(label)}
              className="hero-chip h-11 shrink-0 rounded-full border border-[var(--hero-border)] bg-white px-4 text-[13.5px] font-medium text-[var(--hero-dark)]"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="flex items-center gap-2 text-[14.5px] text-[var(--hero-body)]">
        <HelpIcon className="size-4 text-[var(--hero-indigo)]" />
        {help}{' '}
        <Link to="/doctors" className="font-semibold text-[var(--hero-indigo-dark)] hover:underline">
          {helpLink} →
        </Link>
      </p>
    </div>
  );
}
