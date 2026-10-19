import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide',
  {
    variants: {
      tone: {
        neutral: 'bg-sand text-ink-muted',
        soon: 'bg-bluegrey/25 text-info-ink',
        success: 'bg-success-surface text-success-ink',
        warning: 'bg-warning-surface text-warning-ink',
        accent: 'bg-peach/70 text-ink',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

interface BadgeProps extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
