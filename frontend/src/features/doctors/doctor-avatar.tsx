import { cn } from '@/lib/cn';

/** Initials only: profile photos need private storage, which is not set up yet. */
export function DoctorAvatar({ name, className }: { name: string; className?: string }) {
  const initials = name
    .replace(/^dr\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
  return (
    <div
      aria-hidden="true"
      className={cn(
        'grid size-14 shrink-0 place-items-center rounded-full bg-peach/70 text-lg font-semibold text-ink',
        className,
      )}
    >
      {initials}
    </div>
  );
}
