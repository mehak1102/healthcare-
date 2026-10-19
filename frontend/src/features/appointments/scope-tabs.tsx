import { cn } from '@/lib/cn';
import type { Scope } from './api';

export function ScopeTabs({ scope, onChange }: { scope: Scope; onChange: (scope: Scope) => void }) {
  return (
    <div className="inline-flex rounded-[var(--radius-control)] border border-line bg-surface p-1">
      {(['upcoming', 'past'] as const).map((value) => (
        <button
          key={value}
          type="button"
          aria-pressed={scope === value}
          onClick={() => onChange(value)}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
            scope === value ? 'bg-sand text-ink' : 'text-ink-muted hover:text-ink',
          )}
        >
          {value === 'upcoming' ? 'Upcoming' : 'Past'}
        </button>
      ))}
    </div>
  );
}
