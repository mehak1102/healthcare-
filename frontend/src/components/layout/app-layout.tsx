import { Suspense } from 'react';
import { Outlet, ScrollRestoration } from 'react-router';
import { SiteLanguageProvider } from '@/lib/use-site-language';
import { EmergencyNotice } from './emergency-notice';
import { PageLoading } from './page-loading';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

export function AppLayout() {
  return (
    <SiteLanguageProvider>
      <div className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-surface px-4 py-2 font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        >
          Skip to main content
        </a>
        <EmergencyNotice />
        <SiteHeader />
        <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
        <SiteFooter />
        <ScrollRestoration />
      </div>
    </SiteLanguageProvider>
  );
}
