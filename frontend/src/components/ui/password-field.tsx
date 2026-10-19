import { Eye, EyeOff } from 'lucide-react';
import { useState, type ComponentProps } from 'react';
import { FormField } from './form-field';

type PasswordFieldProps = Omit<ComponentProps<typeof FormField>, 'type' | 'trailing'>;

export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="grid size-9 place-items-center rounded-lg text-ink-muted hover:bg-sand hover:text-ink"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      }
    />
  );
}
