import { cn } from '@/lib/cn';

/** Desktop nav link. Size eases with `--nav-morph` on the header shell. */
export const desktopNavLinkClass = (active: boolean) =>
  cn(
    'relative inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-0.5 font-normal tracking-[0.02em] transition-colors duration-200',
    'py-0 text-[0.98rem] leading-none xl:text-[1.0625rem] 2xl:text-[1.125rem]',
    'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-ink',
    active ? 'text-ink' : 'text-ink/75',
  );

export const navPillCtaClass = cn(
  'inline-flex shrink-0 items-center justify-center rounded-full bg-ink font-semibold tracking-[0.04em] text-canvas uppercase transition-colors duration-200 hover:bg-ink/88 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-ink',
  'h-11 px-6 text-[0.9375rem] lg:h-[calc(2.75rem-0.25rem*var(--nav-morph,0))] lg:px-[calc(1.5rem-0.25rem*var(--nav-morph,0))]',
);

export const navLoginLinkClass =
  'inline-flex shrink-0 items-center whitespace-nowrap text-[1.0625rem] font-normal tracking-[0.02em] text-ink/75 transition-colors duration-200 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-coral-ink';
