import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Menu, X } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { ServicesNavDropdown } from '@/components/layout/services-nav-dropdown';
import {
  navLinkHidesInCompact,
  PRIMARY_NAV_LINKS,
} from '@/components/layout/site-nav-config';
import { desktopNavLinkClass, navLoginLinkClass, navPillCtaClass } from '@/components/layout/site-nav-styles';
import { useNavScrollMorph } from '@/components/layout/use-nav-scroll-morph';
import { buttonVariants } from '@/components/ui/button-variants';
import { homeForRoles } from '@/features/auth/home-for-roles';
import { useCurrentUser } from '@/features/auth/use-auth';
import { cn } from '@/lib/cn';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { LanguageToggle } from '@/features/home/hero/language-toggle';
import { Logo } from './logo';

function dashboardLabel(roles: readonly string[], compact: boolean): string {
  if (compact) return 'Dashboard';
  if (roles.includes('doctor')) return 'Doctor dashboard';
  if (roles.includes('patient')) return 'Patient dashboard';
  return 'Dashboard';
}

export function SiteHeader() {
  const { data: user, isPending } = useCurrentUser();
  const { pathname } = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const [mobileOpen, setMobileOpen] = useState(false);

  const headerRef = useRef<HTMLElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const wordmarkRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLDivElement>(null);
  const navListRef = useRef<HTMLUListElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const mobileBackdropRef = useRef<HTMLDivElement>(null);
  const entranceDone = useRef(false);

  const updateIndicator = useCallback(() => {
    const list = navListRef.current;
    const indicator = indicatorRef.current;
    if (!list || !indicator) return;

    const candidates = list.querySelectorAll<HTMLElement>(
      '[data-nav-item][aria-current="page"], [data-nav-item][data-nav-active="true"]',
    );

    const isVisibleNavItem = (el: HTMLElement) => {
      if (el.closest('[data-nav-compact-collapsed]')) return false;
      const li = el.closest('li');
      if (li && li.style.visibility === 'hidden') return false;
      const rect = el.getBoundingClientRect();
      return rect.width > 6 && rect.height > 6;
    };

    const activeEl = [...candidates].find(isVisibleNavItem);
    if (!activeEl) {
      gsap.killTweensOf(indicator);
      gsap.set(indicator, { opacity: 0, clearProps: 'x,xPercent' });
      return;
    }

    const listRect = list.getBoundingClientRect();
    const activeRect = activeEl.getBoundingClientRect();
    const left = activeRect.left - listRect.left + activeRect.width / 2;

    if (reducedMotion) {
      indicator.style.opacity = '1';
      indicator.style.transform = `translate(${left}px, 0) translateX(-50%)`;
      return;
    }

    gsap.killTweensOf(indicator);
    gsap.to(indicator, {
      x: left,
      xPercent: -50,
      opacity: 1,
      duration: 0.35,
      ease: 'power3.out',
      overwrite: true,
    });
  }, [reducedMotion]);

  const onMorphProgress = useCallback(() => {
    requestAnimationFrame(() => updateIndicator());
  }, [updateIndicator]);

  const { compactUi } = useNavScrollMorph(
    reducedMotion,
    { shellRef, innerRef, wordmarkRef, markRef, navListRef, headerRef },
    onMorphProgress,
  );

  useLayoutEffect(() => {
    updateIndicator();
  }, [pathname, updateIndicator, compactUi]);

  useEffect(() => {
    ScrollTrigger.refresh();
    requestAnimationFrame(() => updateIndicator());
  }, [pathname, updateIndicator]);

  useEffect(() => {
    const onResize = () => updateIndicator();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateIndicator]);

  useEffect(() => {
    if (entranceDone.current || !headerRef.current) return;
    entranceDone.current = true;

    const header = headerRef.current;
    const logo = header.querySelector('[data-nav-logo]');
    const items = header.querySelectorAll('[data-nav-entrance]');
    const cta = header.querySelector('[data-nav-cta]');

    if (reducedMotion) return;

    const targets = [logo, ...items, cta].filter(Boolean);
    gsap.set(targets, { opacity: 0, y: 8 });

    const tl = gsap.timeline({
      defaults: { ease: 'power3.out' },
      delay: 0.05,
      onComplete: () => {
        // Drop inline opacity/transform so scroll morph CSS can drive them.
        gsap.set(targets, { clearProps: 'opacity,transform' });
      },
    });
    tl.to(logo, { opacity: 1, y: 0, duration: 0.45 })
      .to(items, { opacity: 1, y: 0, duration: 0.4, stagger: 0.06 }, '-=0.28')
      .to(cta, { opacity: 1, y: 0, duration: 0.4 }, '-=0.2');
  }, [reducedMotion]);

  useEffect(() => {
    const panel = mobilePanelRef.current;
    const backdrop = mobileBackdropRef.current;
    if (!panel || !backdrop) return;

    if (reducedMotion) {
      panel.hidden = !mobileOpen;
      backdrop.hidden = !mobileOpen;
      return;
    }

    gsap.killTweensOf([panel, backdrop]);
    if (mobileOpen) {
      panel.hidden = false;
      backdrop.hidden = false;
      gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      gsap.fromTo(
        panel,
        { height: 0, opacity: 0 },
        {
          height: 'auto',
          opacity: 1,
          duration: 0.38,
          ease: 'power2.out',
          onComplete: () => {
            const links = panel.querySelectorAll('[data-mobile-nav-item]');
            gsap.fromTo(
              links,
              { opacity: 0, x: -8 },
              { opacity: 1, x: 0, duration: 0.28, stagger: 0.035, ease: 'power2.out' },
            );
          },
        },
      );
    } else {
      gsap.to(panel, {
        height: 0,
        opacity: 0,
        duration: 0.28,
        ease: 'power2.in',
        onComplete: () => {
          panel.hidden = true;
        },
      });
      gsap.to(backdrop, {
        opacity: 0,
        duration: 0.22,
        onComplete: () => {
          backdrop.hidden = true;
        },
      });
    }
  }, [mobileOpen, reducedMotion]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const closeMobile = () => setMobileOpen(false);

  const closeOnLinkClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest('a, button')) closeMobile();
  };

  const navCompact = compactUi;

  const authActions = isPending ? (
    <div className="h-10 w-36" aria-hidden="true" data-nav-cta />
  ) : user ? (
    <Link to={homeForRoles(user.roles)} className={navPillCtaClass} data-nav-cta>
      {dashboardLabel(user.roles, navCompact)}
    </Link>
  ) : (
    <div className="flex items-center gap-5" data-nav-cta>
      {!navCompact && (
        <Link to="/login" className={cn(navLoginLinkClass, 'max-xl:hidden')}>
          Log in
        </Link>
      )}
      <Link to="/register" className={navPillCtaClass}>
        Sign up
      </Link>
    </div>
  );

  const renderDesktopNavLink = (item: (typeof PRIMARY_NAV_LINKS)[number]) => (
    <li
      key={item.to}
      data-nav-entrance
      {...(navLinkHidesInCompact(item) ? { 'data-nav-compact-hide': true } : {})}
    >
      <NavLink
        to={item.to}
        end={'end' in item ? item.end : undefined}
        className={({ isActive }) => desktopNavLinkClass(isActive)}
        data-nav-item="true"
      >
        <span className="whitespace-nowrap">
          {navCompact && 'compactLabel' in item ? item.compactLabel : item.label}
        </span>
      </NavLink>
    </li>
  );

  return (
    <header ref={headerRef} className="pointer-events-none sticky top-0 z-40 w-full">
      <div
        ref={shellRef}
        data-nav-shell
        className="group pointer-events-auto mx-auto max-lg:w-full"
      >
        <div
          ref={innerRef}
          data-nav-inner
          className="flex min-h-[4.75rem] w-full min-w-0 items-center justify-between gap-3 px-5 sm:min-h-[5rem] sm:px-8 lg:h-full lg:min-h-0 lg:gap-5 lg:px-0"
        >
          <div
            className="flex min-w-0 items-center gap-4 lg:gap-[length:calc(1.5rem-0.375rem*var(--nav-morph,0))]"
            data-nav-cluster
          >
            <div className="flex h-10 shrink-0 items-center" data-nav-logo>
              <div ref={wordmarkRef} data-nav-logo-wordmark className="shrink-0 overflow-hidden">
                <Logo variant="wordmark" className="max-lg:!opacity-100 whitespace-nowrap" />
              </div>
              <div
                ref={markRef}
                data-nav-logo-mark
                className="hidden h-10 shrink-0 overflow-hidden lg:block"
                aria-hidden="true"
              >
                <Logo variant="mark" className="!size-10" />
              </div>
            </div>

            <nav aria-label="Main" className="hidden min-w-0 lg:block">
              <ul
                ref={navListRef}
                data-nav-list
                className="relative flex items-center justify-center gap-[length:calc(1.75rem-0.25rem*var(--nav-morph,0))] [&>li]:shrink-0"
              >
                {PRIMARY_NAV_LINKS.slice(0, 2).map((item) => renderDesktopNavLink(item))}
                <li data-nav-entrance data-nav-compact-hide>
                  <ServicesNavDropdown />
                </li>
                {PRIMARY_NAV_LINKS.slice(2).map((item) => renderDesktopNavLink(item))}
                <span
                  ref={indicatorRef}
                  className="pointer-events-none absolute top-[calc(100%+0.35rem)] left-0 size-[6px] rounded-full bg-coral opacity-0 will-change-transform"
                  aria-hidden="true"
                />
              </ul>
            </nav>
          </div>

          <div className="hidden shrink-0 items-center gap-3 lg:flex" data-nav-auth>
            <LanguageToggle compact />
            {authActions}
          </div>

          <div className="flex items-center gap-2 lg:hidden">
            <LanguageToggle compact />
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full text-ink transition-colors hover:bg-sand/80 lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileOpen((value) => !value)}
          >
            {mobileOpen ? (
              <X className="size-5" aria-hidden="true" />
            ) : (
              <Menu className="size-5" aria-hidden="true" />
            )}
          </button>
          </div>
        </div>
      </div>

      <div
        ref={mobileBackdropRef}
        hidden={!mobileOpen}
        className="pointer-events-auto fixed inset-0 top-[4.75rem] z-30 bg-ink/15 backdrop-blur-[2px] sm:top-[5rem] lg:hidden"
        aria-hidden="true"
        onClick={closeMobile}
      />

      {/* oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
      <div
        id="mobile-menu"
        ref={mobilePanelRef}
        hidden={!mobileOpen}
        onClick={closeOnLinkClick}
        className="pointer-events-auto relative z-40 overflow-hidden border-t border-line/70 bg-canvas lg:hidden"
      >
        <nav aria-label="Main (mobile)" className="px-5 pt-4 pb-8 sm:px-8">
          <ul className="flex flex-col">
            {PRIMARY_NAV_LINKS.slice(0, 2).map((item) => (
              <li key={item.to} data-mobile-nav-item>
                <NavLink
                  to={item.to}
                  end={'end' in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      'block py-4 text-[1.0625rem] font-normal tracking-[0.02em] transition-colors',
                      isActive ? 'text-ink' : 'text-ink/75',
                    )
                  }
                  onClick={closeMobile}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
            <li data-mobile-nav-item>
              <ServicesNavDropdown variant="mobile" onNavigate={closeMobile} />
            </li>
            {PRIMARY_NAV_LINKS.slice(2).map((item) => (
              <li key={item.to} data-mobile-nav-item>
                <NavLink
                  to={item.to}
                  end={'end' in item ? item.end : undefined}
                  className={({ isActive }) =>
                    cn(
                      'block py-4 text-[1.0625rem] font-normal tracking-[0.02em] transition-colors',
                      isActive ? 'text-ink' : 'text-ink/75',
                    )
                  }
                  onClick={closeMobile}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-col gap-3 border-t border-line/70 pt-6">
            {isPending ? (
              <div className="h-10" aria-hidden="true" />
            ) : user ? (
              <Link
                to={homeForRoles(user.roles)}
                className={cn(navPillCtaClass, 'w-full')}
                onClick={closeMobile}
              >
                {dashboardLabel(user.roles, false)}
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className={cn(navPillCtaClass, 'w-full')}
                  onClick={closeMobile}
                >
                  Sign up
                </Link>
                <Link
                  to="/login"
                  className={buttonVariants({ variant: 'ghost', className: 'w-full font-normal' })}
                  onClick={closeMobile}
                >
                  Log in
                </Link>
              </>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}
