import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: ReactNode;
  error?: string;
  trailing?: ReactNode;
}

/** Labelled input with hint and error text wired to aria-describedby / aria-invalid. */
export function FormField({
  label,
  hint,
  error,
  trailing,
  className,
  id,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={inputId} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
          className={cn(
            'h-11 w-full rounded-[var(--radius-control)] border bg-surface px-3.5 text-[0.95rem] text-ink placeholder:text-ink-muted/70 transition-colors',
            'focus-visible:border-coral-ink focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-coral-ink/25',
            error ? 'border-danger-ink' : 'border-line hover:border-rose',
            trailing ? 'pr-12' : undefined,
          )}
          {...inputProps}
        />
        {trailing && (
          <div className="absolute inset-y-0 right-1.5 flex items-center">{trailing}</div>
        )}
      </div>
      {hint && !error && (
        <p id={hintId} className="text-xs text-ink-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-sm font-medium text-danger-ink">
          {error}
        </p>
      )}
    </div>
  );
}
