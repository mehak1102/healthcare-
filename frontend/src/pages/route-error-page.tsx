import { isRouteErrorResponse, Link, useRouteError } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { NotFoundPage } from './not-found-page';

export function RouteErrorPage() {
  const error = useRouteError();
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage />;

  return (
    <div
      className="mx-auto flex max-w-xl flex-col items-center px-4 py-24 text-center"
      role="alert"
    >
      <h1 className="text-3xl font-semibold">Something went wrong</h1>
      <p className="mt-3 text-ink-muted">
        Please refresh the page. If the problem continues, try again in a few minutes.
      </p>
      <Link to="/" className={buttonVariants({ className: 'mt-8' })}>
        Back to home
      </Link>
    </div>
  );
}
