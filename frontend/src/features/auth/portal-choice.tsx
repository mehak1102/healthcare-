import { cn } from '@/lib/cn';

export type AccountPortal = 'patient' | 'doctor';
export type LoginPortal = AccountPortal | 'staff';

const OPTIONS: { id: LoginPortal; title: string; text: string }[] = [
  { id: 'patient', title: 'Patient', text: 'Book care and manage your health' },
  { id: 'doctor', title: 'Doctor', text: 'Your practice, after verification' },
  { id: 'staff', title: 'Staff / Admin', text: 'Accounts created by an administrator' },
];

export function PortalChoice<T extends LoginPortal>({
  value,
  onChange,
  legend,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  legend: string;
  options: readonly T[];
}) {
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-ink">{legend}</legend>
      <div
        className={cn(
          'mt-3 grid grid-cols-1 gap-3',
          options.length > 2 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
        )}
      >
        {OPTIONS.filter((option) => options.includes(option.id as T)).map((option) => {
          const id = option.id as T;
          const selected = value === id;
          return (
            <label
              key={id}
              aria-label={option.title}
              className={cn(
                'flex cursor-pointer gap-3 rounded-2xl border p-3 transition-colors',
                selected
                  ? 'border-coral bg-peach/50 shadow-[var(--shadow-soft)]'
                  : 'border-line bg-canvas hover:border-blush',
              )}
            >
              <input
                type="radio"
                name="account-portal"
                value={id}
                checked={selected}
                onChange={() => onChange(id)}
                className="mt-1 size-4 shrink-0 accent-coral-ink"
              />
              <span>
                <span className="block font-semibold">{option.title}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-ink-muted">
                  {option.text}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
