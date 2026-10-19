import { useEffect } from 'react';

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} · Sukoon Health` : 'Sukoon Health — calm, verified care';
  }, [title]);
}
