import { Skeleton } from '@/components/ui/skeleton';

export function PageLoading() {
  return (
    <div
      className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-16"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-1/2" />
      <Skeleton className="mt-4 h-40 w-full" />
    </div>
  );
}
