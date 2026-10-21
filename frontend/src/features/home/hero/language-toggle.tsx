import { cn } from '@/lib/cn';
import { useSiteLanguage } from '@/lib/use-site-language';
import type { HeroLang } from './hero-copy';

export function LanguageToggle({
  compact = false,
  onChange,
}: {
  compact?: boolean;
  onChange?: (lang: HeroLang) => void;
}) {
  const { lang, setLang } = useSiteLanguage();

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl bg-sand p-1',
        compact ? 'h-10' : 'h-11',
      )}
      role="group"
      aria-label="Language"
    >
      {(
        [
          ['en', 'EN'],
          ['hi', 'हिं'],
        ] as const
      ).map(([value, label]) => {
        const active = lang === value;
        return (
          <button
            key={value}
            type="button"
            lang={value}
            aria-pressed={active}
            onClick={() => {
              setLang(value);
              onChange?.(value);
            }}
            className={cn(
              'rounded-lg font-semibold',
              compact ? 'h-8 min-w-9 px-2.5 text-[12.5px]' : 'h-9 min-w-11 px-3 text-[13.5px]',
              active ? 'bg-white text-ink shadow-sm' : 'text-ink-muted',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
