import { Link } from 'react-router';
import { cn } from '@/lib/cn';

type LogoProps = {
  /** Minimal wordmark for the Symboolic-style site header. */
  variant?: 'default' | 'wordmark' | 'mark';
  className?: string;
};

export function Logo({ variant = 'default', className }: LogoProps) {
  if (variant === 'mark') {
    return (
      <Link
        to="/"
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-full border border-line/80 bg-surface shadow-[0_1px_2px_rgb(48_43_43/0.06)]',
          className,
        )}
        aria-label="Sukoon Health home"
      >
        <svg viewBox="0 0 32 32" className="size-6" aria-hidden="true">
          <rect width="32" height="32" rx="9" fill="var(--color-peach)" />
          <path
            d="M16 24.5c-5.2-3.4-8.5-6.6-8.5-10.3A4.3 4.3 0 0 1 16 11.6a4.3 4.3 0 0 1 8.5 2.6c0 3.7-3.3 6.9-8.5 10.3Z"
            fill="var(--color-coral)"
          />
        </svg>
      </Link>
    );
  }

  if (variant === 'wordmark') {
    return (
      <Link
        to="/"
        className={cn(
          'inline-flex items-baseline gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-ink',
          className,
        )}
        aria-label="Sukoon Health home"
      >
        <span className="inline-flex items-center text-[1.25rem] font-bold tracking-[0.18em] text-ink uppercase">
          Suk
          <span
            className="relative mx-px inline-flex size-[1.05em] items-center justify-center rounded-full border-[1.5px] border-ink"
            aria-hidden="true"
          >
            <span className="size-[0.35em] rounded-full bg-coral" />
          </span>
          n
        </span>
        <span className="text-[1.25rem] font-bold tracking-[0.18em] text-ink uppercase">Health</span>
      </Link>
    );
  }

  return (
    <Link
      to="/"
      className={cn('group inline-flex items-center gap-2.5 rounded-lg', className)}
      aria-label="Sukoon Health home"
    >
      <svg viewBox="0 0 32 32" className="size-9" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="var(--color-peach)" />
        <path
          d="M16 24.5c-5.2-3.4-8.5-6.6-8.5-10.3A4.3 4.3 0 0 1 16 11.6a4.3 4.3 0 0 1 8.5 2.6c0 3.7-3.3 6.9-8.5 10.3Z"
          fill="var(--color-coral)"
        />
        <path
          d="M12.5 15.5h2.2l1.1-2 1.6 4 1.1-2h1.9"
          fill="none"
          stroke="var(--color-ink)"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="font-sans text-[1.35rem] leading-none font-semibold tracking-tight text-ink">
        Sukoon<span className="text-coral-ink"> Health</span>
      </span>
    </Link>
  );
}
