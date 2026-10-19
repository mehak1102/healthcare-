import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-ink',
  {
    variants: {
      variant: {
        primary: 'bg-coral text-ink shadow-[var(--shadow-soft)] hover:bg-coral-hover',
        secondary: 'border border-line bg-surface text-ink hover:border-rose hover:bg-sand',
        ghost: 'text-ink hover:bg-sand',
        subtle: 'bg-peach/60 text-ink hover:bg-peach',
        danger: 'border border-danger-ink/30 bg-surface text-danger-ink hover:bg-danger-surface',
        link: 'h-auto px-0 text-coral-ink underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-9 px-3.5 text-sm',
        md: 'h-11 px-5 text-[0.95rem]',
        lg: 'h-12 px-6 text-base',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
