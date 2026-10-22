import { useEffect } from 'react';
import { useLocation } from 'react-router';
import { HomeHero } from '@/features/home/hero/home-hero';
import { HomeVisitHero } from '@/features/home/hero-home-visit/home-visit-hero';
import { HomeServices } from '@/features/home/services/home-services';
import { HomeTrust } from '@/features/home/trust/home-trust';
import { usePageTitle } from '@/lib/use-page-title';

export function HomePage() {
  usePageTitle('');
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <>
      <HomeHero />
      <HomeVisitHero />
      <HomeServices />
      <HomeTrust />
    </>
  );
}
