import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

export const NAV_SCROLL_THRESHOLD = 36;
const DESKTOP_MQ = '(min-width: 1024px)';
const COLLAPSE_AT = 40;
const EXPAND_AT = 8;

type NavScrollMorphRefs = {
  shellRef: RefObject<HTMLDivElement | null>;
  innerRef: RefObject<HTMLDivElement | null>;
  wordmarkRef: RefObject<HTMLDivElement | null>;
  markRef: RefObject<HTMLDivElement | null>;
  navListRef: RefObject<HTMLUListElement | null>;
  headerRef: RefObject<HTMLElement | null>;
};

function expandedPadX(viewportW: number) {
  if (viewportW >= 1536) return 48;
  if (viewportW >= 1440) return 40;
  return 28;
}

/** Compact shell padding (must match nav-morph.css at morph = 1: 1.75rem). */
const COMPACT_PAD_X = 28;
/** Extra room so the mark and CTA clear the pill caps. */
const COMPACT_BREATHING = 36;

/** Intrinsic content width — ignores flex-grow so the pill hugs logo + links + CTA. */
function intrinsicWidth(el: HTMLElement): number {
  const prev = {
    flex: el.style.flex,
    width: el.style.width,
    minWidth: el.style.minWidth,
    maxWidth: el.style.maxWidth,
  };
  el.style.flex = '0 0 auto';
  el.style.width = 'max-content';
  el.style.minWidth = 'min-content';
  el.style.maxWidth = 'none';
  const width = Math.ceil(el.getBoundingClientRect().width);
  el.style.flex = prev.flex;
  el.style.width = prev.width;
  el.style.minWidth = prev.minWidth;
  el.style.maxWidth = prev.maxWidth;
  return width;
}

function measureCompactWidth(inner: HTMLElement | null, viewportW: number) {
  if (!inner) return Math.min(viewportW - 32, 560);

  const gap =
    Number.parseFloat(getComputedStyle(inner).columnGap || getComputedStyle(inner).gap) || 16;
  const parts = [...inner.children].filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false;
    const style = getComputedStyle(child);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });

  const summed = parts.reduce((sum, child, index) => {
    return sum + intrinsicWidth(child) + (index > 0 ? gap : 0);
  }, 0);

  // Prefer live layout width when available (more accurate than a sum).
  const laidOut = Math.ceil(inner.getBoundingClientRect().width);
  const content = Math.max(summed, laidOut);

  return Math.min(
    viewportW - 48,
    Math.max(320, content + COMPACT_PAD_X * 2 + COMPACT_BREATHING),
  );
}

/**
 * Scroll only toggles compact state. The browser animates `--nav-morph` via CSS
 * (@see nav-morph.css) — same pattern as Airbnb’s header (threshold + soft tween).
 */
export function useNavScrollMorph(
  _reducedMotion: boolean,
  refs: NavScrollMorphRefs,
  onProgress?: (progress: number) => void,
) {
  const [compactUi, setCompactUi] = useState(
    () => typeof window !== 'undefined' && window.scrollY > COLLAPSE_AT,
  );
  const [desktopMode, setDesktopMode] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches,
  );
  const [mobileScrolled, setMobileScrolled] = useState(
    () => typeof window !== 'undefined' && window.scrollY > NAV_SCROLL_THRESHOLD,
  );
  const collapsedRef = useRef(false);
  const wordmarkWidthRef = useRef(220);

  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const sync = () => setDesktopMode(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useLayoutEffect(() => {
    const shell = refs.shellRef.current;
    const header = refs.headerRef.current;
    const inner = refs.innerRef.current;
    const wordmark = refs.wordmarkRef.current;
    const mark = refs.markRef.current;
    if (!shell || !header) return;

    const writeMetrics = () => {
      const vw = window.innerWidth;
      shell.style.setProperty('--nav-expanded-w', `${vw}px`);
      shell.style.setProperty('--nav-pad-expanded', `${expandedPadX(vw)}px`);

      if (wordmark) {
        const prevW = wordmark.style.width;
        const prevO = wordmark.style.opacity;
        wordmark.style.width = 'auto';
        wordmark.style.opacity = '1';
        const w = Math.max(wordmark.scrollWidth, wordmark.getBoundingClientRect().width);
        wordmark.style.width = prevW;
        wordmark.style.opacity = prevO;
        if (w > 40) {
          wordmarkWidthRef.current = w;
          shell.style.setProperty('--nav-wordmark-w', `${w}px`);
        }
      }

      // Measure final pill with compact-hidden links removed + mark shown.
      const hideItems = header.querySelectorAll<HTMLElement>('[data-nav-compact-hide]');
      const cluster = header.querySelector<HTMLElement>('[data-nav-cluster]');
      const nav = header.querySelector<HTMLElement>('nav[aria-label="Main"]');
      const savedHide = [...hideItems].map((el) => el.style.display);
      const savedCluster = cluster
        ? { flex: cluster.style.flex, width: cluster.style.width, minWidth: cluster.style.minWidth }
        : null;
      const savedNav = nav ? { flex: nav.style.flex, width: nav.style.width } : null;
      const savedInner = inner
        ? {
            width: inner.style.width,
            justifyContent: inner.style.justifyContent,
            gap: inner.style.gap,
          }
        : null;

      hideItems.forEach((el) => {
        el.style.display = 'none';
      });
      if (cluster) {
        cluster.style.flex = '0 0 auto';
        cluster.style.width = 'max-content';
        cluster.style.minWidth = 'max-content';
      }
      if (nav) {
        nav.style.flex = '0 0 auto';
        nav.style.width = 'max-content';
        nav.style.minWidth = 'max-content';
      }
      const prevShellWidth = shell.style.width;
      // Drop the animated width so flex children can report their real size.
      shell.style.width = 'max-content';
      if (inner) {
        inner.style.flex = '0 0 auto';
        inner.style.width = 'max-content';
        inner.style.minWidth = 'max-content';
        inner.style.justifyContent = 'flex-start';
        inner.style.gap = '20px';
      }

      const wmDisplay = wordmark?.style.display ?? '';
      const mkWidth = mark?.style.width ?? '';
      const mkOpacity = mark?.style.opacity ?? '';
      const mkVisibility = mark?.style.visibility ?? '';
      const mkDisplay = mark?.style.display ?? '';
      if (wordmark) wordmark.style.display = 'none';
      if (mark) {
        mark.style.display = 'block';
        mark.style.width = '40px';
        mark.style.opacity = '1';
        mark.style.visibility = 'visible';
      }

      // Expanded-only auth (Log in) must not inflate the compact pill target.
      const loginLink = header.querySelector<HTMLElement>('[data-nav-auth] a[href="/login"]');
      const loginDisplay = loginLink?.style.display ?? '';
      if (loginLink) loginLink.style.display = 'none';

      // Force compact link labels during measure (Find Doctors → Doctors, etc.).
      const labelSpans = header.querySelectorAll<HTMLElement>(
        '[data-nav-list] [data-nav-item] span.whitespace-nowrap',
      );
      const savedLabels = [...labelSpans].map((span) => span.textContent);
      labelSpans.forEach((span) => {
        const full = span.textContent?.trim() ?? '';
        if (full === 'Find Doctors') span.textContent = 'Doctors';
        else if (full === 'Health Packages') span.textContent = 'Packages';
      });

      void inner?.offsetWidth;
      const compactW = measureCompactWidth(inner, vw);

      hideItems.forEach((el, i) => {
        el.style.display = savedHide[i];
      });
      if (cluster && savedCluster) {
        cluster.style.flex = savedCluster.flex;
        cluster.style.width = savedCluster.width;
        cluster.style.minWidth = savedCluster.minWidth;
      }
      if (nav && savedNav) {
        nav.style.flex = savedNav.flex;
        nav.style.width = savedNav.width;
      }
      shell.style.width = prevShellWidth;
      if (inner && savedInner) {
        inner.style.flex = '';
        inner.style.minWidth = '';
        inner.style.width = savedInner.width;
        inner.style.justifyContent = savedInner.justifyContent;
        inner.style.gap = savedInner.gap;
      }
      if (wordmark) wordmark.style.display = wmDisplay;
      if (mark) {
        mark.style.display = mkDisplay;
        mark.style.width = mkWidth;
        mark.style.opacity = mkOpacity;
        mark.style.visibility = mkVisibility;
      }
      if (loginLink) loginLink.style.display = loginDisplay;
      labelSpans.forEach((span, i) => {
        span.textContent = savedLabels[i] ?? span.textContent;
      });
      shell.style.setProperty('--nav-compact-w', `${compactW}px`);
    };

    const ensureFits = () => {
      if (!collapsedRef.current) return;
      const shellRect = shell.getBoundingClientRect();
      const authEl = header.querySelector<HTMLElement>('[data-nav-auth]');
      if (!authEl || shellRect.width < 80) return;
      const authRect = authEl.getBoundingClientRect();
      const markRect = mark?.getBoundingClientRect();
      const rightShort = Math.max(0, COMPACT_PAD_X - (shellRect.right - authRect.right));
      const leftShort = markRect
        ? Math.max(0, COMPACT_PAD_X - (markRect.left - shellRect.left))
        : 0;
      const extra = Math.ceil(rightShort + leftShort);
      if (extra < 2) return;
      shell.style.setProperty('--nav-compact-w', `${Math.ceil(shellRect.width + extra)}px`);
    };

    writeMetrics();

    let indicatorRaf = 0;
    const stopIndicatorLoop = () => {
      cancelAnimationFrame(indicatorRaf);
      indicatorRaf = 0;
    };
    const startIndicatorLoop = () => {
      if (!onProgress) return;
      stopIndicatorLoop();
      const tick = () => {
        const raw = getComputedStyle(shell).getPropertyValue('--nav-morph').trim();
        const value = Number.parseFloat(raw);
        onProgress(Number.isFinite(value) ? value : collapsedRef.current ? 1 : 0);
        indicatorRaf = requestAnimationFrame(tick);
      };
      tick();
    };

    const applyCollapsed = (collapsed: boolean, animate: boolean) => {
      if (collapsed) {
        // Collapse: measure tight pill first, then morph 0 → 1 so width can shrink to it.
        writeMetrics();
        setCompactUi(true);
      } else {
        // Expand: pin current pill width as the morph start so width doesn't jump.
        const currentW = Math.round(shell.getBoundingClientRect().width);
        if (currentW > 80 && currentW < window.innerWidth - 24) {
          shell.style.setProperty('--nav-compact-w', `${currentW}px`);
        } else {
          writeMetrics();
        }
      }

      collapsedRef.current = collapsed;
      shell.dataset.compact = collapsed ? 'true' : 'false';

      if (!animate) {
        stopIndicatorLoop();
        shell.style.transition = 'none';
        void shell.offsetWidth;
        shell.style.transition = '';
        setCompactUi(collapsed);
        onProgress?.(collapsed ? 1 : 0);
        if (collapsed) requestAnimationFrame(() => ensureFits());
        return;
      }

      // Expand: keep compact labels until morph finishes (avoids mid-flight CTA jump).
      if (!collapsed) {
        window.setTimeout(() => {
          if (!collapsedRef.current) setCompactUi(false);
        }, 1100);
      }
      startIndicatorLoop();
    };

    const onTransitionEnd = (event: TransitionEvent) => {
      if (event.target !== shell) return;
      if (event.propertyName && event.propertyName !== '--nav-morph') return;
      stopIndicatorLoop();
      onProgress?.(collapsedRef.current ? 1 : 0);
      setCompactUi(collapsedRef.current);
      // Remeasure after labels settle, then grow the pill if the mark or CTA still clips.
      requestAnimationFrame(() => {
        writeMetrics();
        requestAnimationFrame(() => ensureFits());
      });
    };
    shell.addEventListener('transitionend', onTransitionEnd);

    const initial = window.scrollY > COLLAPSE_AT;
    applyCollapsed(initial, false);

    const onScroll = () => {
      if (!window.matchMedia(DESKTOP_MQ).matches) return;
      const y = window.scrollY;
      const next = collapsedRef.current ? y > EXPAND_AT : y > COLLAPSE_AT;
      if (next === collapsedRef.current) return;
      applyCollapsed(next, true);
    };

    const onResize = () => writeMetrics();

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);

    return () => {
      stopIndicatorLoop();
      shell.removeEventListener('transitionend', onTransitionEnd);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      delete shell.dataset.compact;
      shell.style.removeProperty('--nav-expanded-w');
      shell.style.removeProperty('--nav-compact-w');
      shell.style.removeProperty('--nav-pad-expanded');
      shell.style.removeProperty('--nav-wordmark-w');
      shell.style.transition = '';
    };
  }, [
    refs.shellRef,
    refs.innerRef,
    refs.wordmarkRef,
    refs.markRef,
    refs.navListRef,
    refs.headerRef,
    onProgress,
    desktopMode,
  ]);

  useEffect(() => {
    const shell = refs.shellRef.current;
    const onScroll = () => {
      if (window.matchMedia(DESKTOP_MQ).matches) {
        if (shell) delete shell.dataset.scrolled;
        return;
      }
      const scrolled = window.scrollY > NAV_SCROLL_THRESHOLD;
      setMobileScrolled(scrolled);
      if (shell) shell.dataset.scrolled = scrolled ? 'true' : 'false';
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [refs.shellRef]);

  return { compactUi, mobileScrolled };
}
