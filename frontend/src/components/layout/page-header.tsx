import type { ReactNode } from 'react';

interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ eyebrow, title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-5 border-b border-line pb-8 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-2">
        {eyebrow && (
          <p className="text-sm font-semibold tracking-wide text-coral-ink uppercase">{eyebrow}</p>
        )}
        <h1 className="text-3xl font-semibold sm:text-4xl">{title}</h1>
        {description && (
          <div className="text-base leading-relaxed text-ink-muted">{description}</div>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
