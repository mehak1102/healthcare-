import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface AuthShellProps {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer: ReactNode;
  wide?: boolean;
}

export function AuthShell({ title, description, children, footer, wide = false }: AuthShellProps) {
  return (
    <div className="relative overflow-hidden px-4 py-14 sm:py-20">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-peach/35 blur-3xl"
      />
      <div className={cn('relative mx-auto w-full', wide ? 'max-w-lg' : 'max-w-md')}>
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold sm:text-[2.1rem]">{title}</h1>
          <p className="mt-2 text-ink-muted">{description}</p>
        </div>
        <div className="rounded-[var(--radius-card)] border border-line bg-surface p-6 shadow-[var(--shadow-lifted)] sm:p-8">
          {children}
        </div>
        <div className="mt-6 text-center text-sm text-ink-muted">{footer}</div>
      </div>
    </div>
  );
}
