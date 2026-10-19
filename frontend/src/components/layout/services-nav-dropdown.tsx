import { ChevronDown } from 'lucide-react';
import gsap from 'gsap';
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router';
import { SERVICE_LINKS, isServicesPath } from '@/components/layout/site-nav-config';
import { desktopNavLinkClass } from '@/components/layout/site-nav-styles';
import { usePrefersReducedMotion } from '@/lib/use-prefers-reduced-motion';
import { cn } from '@/lib/cn';

type ServicesNavDropdownProps = {
  className?: string;
  linkClassName?: string;
  onNavigate?: () => void;
  variant?: 'desktop' | 'mobile';
};

export function ServicesNavDropdown({
  className,
  linkClassName,
  onNavigate,
  variant = 'desktop',
}: ServicesNavDropdownProps) {
  const menuId = useId();
  const { pathname } = useLocation();
  const reducedMotion = usePrefersReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const servicesActive = isServicesPath(pathname);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    close();
  }, [pathname, close]);

  useEffect(() => {
    const panel = panelRef.current;
    if (!panel || variant !== 'desktop') return;

    if (reducedMotion) {
      panel.style.opacity = open ? '1' : '0';
      panel.style.pointerEvents = open ? 'auto' : 'none';
      panel.style.visibility = open ? 'visible' : 'hidden';
      return;
    }

    gsap.killTweensOf(panel);
    if (open) {
      gsap.set(panel, { visibility: 'visible', pointerEvents: 'auto' });
      gsap.fromTo(
        panel,
        { opacity: 0, y: -6, scale: 0.98 },
        { opacity: 1, y: 0, scale: 1, duration: 0.28, ease: 'power2.out' },
      );
      const items = itemRefs.current.filter(Boolean);
      gsap.fromTo(
        items,
        { opacity: 0, y: -4 },
        { opacity: 1, y: 0, duration: 0.22, stagger: 0.04, ease: 'power2.out', delay: 0.04 },
      );
    } else {
      gsap.to(panel, {
        opacity: 0,
        y: -4,
        scale: 0.98,
        duration: 0.18,
        ease: 'power2.in',
        onComplete: () => {
          gsap.set(panel, { visibility: 'hidden', pointerEvents: 'none' });
        },
      });
    }
  }, [open, reducedMotion, variant]);

  const toggle = () => setOpen((value) => !value);

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      setOpen(true);
      requestAnimationFrame(() => itemRefs.current[0]?.focus());
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggle();
    }
  };

  if (variant === 'mobile') {
    return (
      <div className={cn('flex flex-col', className)}>
        <button
          type="button"
          className={cn(
            'flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-left text-[1.0625rem] font-normal tracking-[0.02em] transition-colors hover:bg-sand',
            servicesActive ? 'text-ink' : 'text-ink-muted',
            linkClassName,
          )}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={toggle}
        >
          Services
          <ChevronDown
            className={cn('size-4 transition-transform duration-200', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        <div
          id={menuId}
          hidden={!open}
          className="flex flex-col gap-0.5 pb-2 pl-3"
          role="menu"
        >
          {SERVICE_LINKS.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              className="rounded-lg px-3 py-2.5 text-[0.95rem] text-ink-muted hover:bg-sand hover:text-ink"
              onClick={() => {
                close();
                onNavigate?.();
              }}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        type="button"
        className={cn(
          desktopNavLinkClass(servicesActive || open),
          linkClassName,
        )}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={toggle}
        onKeyDown={onTriggerKeyDown}
        data-nav-item="true"
        data-nav-active={servicesActive ? 'true' : 'false'}
      >
        Services
        <ChevronDown
          className={cn('size-3.5 -mt-px opacity-60 transition-transform duration-200', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      <div
        id={menuId}
        ref={panelRef}
        role="menu"
        aria-label="Services"
        className="absolute top-full left-1/2 z-50 mt-3 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-[var(--radius-card)] border border-line bg-surface p-2 shadow-[var(--shadow-lifted)]"
        style={{ opacity: 0, visibility: 'hidden', pointerEvents: 'none' }}
      >
        {SERVICE_LINKS.map((item, index) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              role="menuitem"
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              className={cn(
                'block rounded-[var(--radius-control)] px-3 py-2.5 text-[0.95rem] transition-colors hover:bg-sand',
                active ? 'font-semibold text-ink' : 'text-ink-muted hover:text-ink',
              )}
              onClick={() => {
                close();
                onNavigate?.();
              }}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
