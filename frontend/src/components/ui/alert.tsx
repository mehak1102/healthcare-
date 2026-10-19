import { cva, type VariantProps } from 'class-variance-authority';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const alertVariants = cva('flex gap-3 rounded-[var(--radius-control)] border px-4 py-3 text-sm', {
  variants: {
    tone: {
      info: 'border-bluegrey/50 bg-info-surface text-info-ink',
      success: 'border-sage/60 bg-success-surface text-success-ink',
      warning: 'border-[#e5cf9f] bg-warning-surface text-warning-ink',
      error: 'border-danger-ink/25 bg-danger-surface text-danger-ink',
    },
  },
  defaultVariants: { tone: 'info' },
});

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

interface AlertProps extends VariantProps<typeof alertVariants> {
  title?: string;
  children?: ReactNode;
  className?: string;
}

/** Errors are announced assertively; other tones politely. */
export function Alert({ tone = 'info', title, children, className }: AlertProps) {
  const Icon = ICONS[tone ?? 'info'];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone }), className)}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  );
}
