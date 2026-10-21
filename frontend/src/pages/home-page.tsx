import { ClipboardCheck } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'react-router';
import { buttonVariants } from '@/components/ui/button-variants';
import { useCurrentUser } from '@/features/auth/use-auth';
import { HomeHero } from '@/features/home/hero/home-hero';
import { HomeServices } from '@/features/home/services/home-services';
import { HomeTrust } from '@/features/home/trust/home-trust';
import { usePageTitle } from '@/lib/use-page-title';

export function HomePage() {
  usePageTitle('');
  const { data: user } = useCurrentUser();
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
      <HomeHero />
      <HomeServices />
      <HomeTrust />
      {!user && (
        <div className="mx-auto max-w-[1240px] px-6 pb-16">
          <div className="flex flex-col items-start justify-between gap-6 rounded-[var(--radius-card)] bg-peach/45 p-8 sm:flex-row sm:items-center sm:p-10">
            <div>
              <h2 className="text-2xl font-semibold">Be ready when booking opens</h2>
              <p className="mt-1 text-ink-muted">
                Create your account now and manage your privacy settings from day one.
              </p>
            </div>
            <Link to="/register" className={buttonVariants({ size: 'lg' })}>
              <ClipboardCheck className="size-4" aria-hidden="true" />
              Create account
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
