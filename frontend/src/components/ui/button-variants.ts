import { cva } from 'class-variance-authority';

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold whitespace-nowrap transition-colors duration-150 disabled:pointer-events-none disabled:opacity-55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-ink',
  {
    variants: {
      variant: {
        primary:
          'bg-ink text-white shadow-[0_10px_24px_-10px_rgb(14_18_34/0.55)] hover:bg-ink/90',
        secondary: 'border border-line bg-surface text-ink hover:border-rose hover:bg-sand',
        ghost: 'text-ink hover:bg-sand',
        subtle: 'bg-peach text-coral-ink hover:bg-blush/80',
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
