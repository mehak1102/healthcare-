import { cn } from '@/lib/cn';

export type SuggestionKind = 'specialty' | 'symptom' | 'doctor';

export interface SuggestionRow {
  id: string;
  kind: SuggestionKind;
  title: string;
  subtitle: string;
  initials?: string;
  fill: string;
  href?: string;
}

export function SuggestionsDropdown({
  id,
  groups,
  highlight,
  emptyLabel,
  onHighlight,
  onPick,
}: {
  id: string;
  groups: { group: string; items: SuggestionRow[] }[];
  highlight: string | null;
  emptyLabel: string;
  onHighlight: (id: string) => void;
  onPick: (item: SuggestionRow) => void;
}) {
  const flat = groups.flatMap((group) => group.items);

  return (
    <div
      id={id}
      role="listbox"
      className="absolute top-[calc(100%+8px)] left-0 z-50 w-[min(100%,440px)] overflow-hidden rounded-[20px] border border-white/80 bg-white/92 py-2 shadow-[0_24px_60px_-24px_rgb(14_18_34/0.45)] backdrop-blur-xl"
    >
      {flat.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--hero-muted)]">{emptyLabel}</p>
      ) : (
        groups.map((group) => (
          <div key={group.group}>
            <p className="px-4 pt-2 pb-1 text-[11px] font-semibold tracking-[0.08em] text-[var(--hero-muted)] uppercase">
              {group.group}
            </p>
            {group.items.map((item) => {
              const active = highlight === item.id;
              return (
                <button
                  key={item.id}
                  id={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => onHighlight(item.id)}
                  onClick={() => onPick(item)}
                  className={cn(
                    'flex w-full items-center gap-3 px-4 py-2.5 text-left',
                    active ? 'bg-[var(--hero-tint-3)]' : 'bg-transparent',
                  )}
                >
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full text-[13px] font-semibold',
                      item.kind === 'doctor'
                        ? 'bg-[#FFE9DE] text-[#B4532A]'
                        : 'bg-[var(--hero-tint)] text-[var(--hero-indigo-dark)]',
                    )}
                  >
                    {item.initials}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14.5px] font-medium text-[var(--hero-ink)]">
                      {item.title}
                    </span>
                    <span className="block truncate text-[12.5px] text-[var(--hero-muted)]">
                      {item.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
