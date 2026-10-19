import { Link } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { usePageTitle } from '@/lib/use-page-title';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center">
      <p className="font-sans text-7xl font-semibold text-blush">404</p>
      <h1 className="mt-4 text-3xl font-semibold">We couldn't find that page</h1>
      <p className="mt-3 text-ink-muted">It may have moved, or the link may be incomplete.</p>
      <Link to="/" className={buttonVariants({ className: 'mt-8' })}>
        Back to home
      </Link>
    </div>
  );
}
