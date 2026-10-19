import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

gsap.registerPlugin(ScrollTrigger);

export const NAV_SCROLL_THRESHOLD = 36;
const DESKTOP_MQ = '(min-width: 1024px)';
const MORPH_SCROLL_DISTANCE = 140;
const SCRUB_SMOOTHING = 1.15;
const SCROLL_TRIGGER_ID = 'site-nav-morph';
const INK_SHADOW = '48, 43, 43';
const easeMorph = gsap.parseEase('power2.inOut');

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

function measureCompactWidth(inner: HTMLElement | null, padX: number, viewportW: number) {
  if (!inner) return Math.min(viewportW - 32, 560);

  const gap = Number.parseFloat(getComputedStyle(inner).columnGap || getComputedStyle(inner).gap) || 16;
  const parts = [...inner.children].filter((child): child is HTMLElement => {
    if (!(child instanceof HTMLElement)) return false;
    const style = getComputedStyle(child);
    return style.display !== 'none' && child.getBoundingClientRect().width > 1;
  });

  const content = parts.reduce((sum, child, index) => {
    const width = child.scrollWidth || child.getBoundingClientRect().width;
    return sum + width + (index > 0 ? gap : 0);
  }, 0);

  return Math.min(viewportW - 24, content + padX * 2 + 4);
}

function applyShellProgress(shell: HTMLElement, t: number, viewportW: number, compactWidth: number) {
  const compactInset = 8;
  const padX = gsap.utils.interpolate(expandedPadX(viewportW), compactInset)(t);
  const padY = gsap.utils.interpolate(0, compactInset)(t);
  const width = gsap.utils.interpolate(viewportW, compactWidth)(t);
  const minH = gsap.utils.interpolate(88, 0)(t);
  const radius = gsap.utils.interpolate(0, 9999)(t);
  const marginTop = gsap.utils.interpolate(0, 12)(t);
  const bgAlpha = t;
  const shadow = t;

  shell.style.setProperty('--nav-morph', String(t));
  shell.style.width = `${width}px`;
  shell.style.maxWidth = `${viewportW}px`;
  shell.style.marginLeft = 'auto';
  shell.style.marginRight = 'auto';
  shell.style.marginTop = `${marginTop}px`;
  shell.style.borderRadius = `${radius}px`;
  shell.style.minHeight = minH > 4 ? `${minH}px` : '0px';
  shell.style.height = t > 0.8 ? 'auto' : '';
  shell.style.paddingLeft = `${padX}px`;
  shell.style.paddingRight = `${padX}px`;
  shell.style.paddingTop = `${padY}px`;
  shell.style.paddingBottom = `${padY}px`;
  shell.style.display = 'flex';
  shell.style.alignItems = 'center';
  shell.style.overflow = 'visible';
  shell.style.backgroundColor = `rgba(255, 255, 255, ${bgAlpha})`;
  shell.style.boxShadow =
    t < 0.04
      ? 'none'
      : [
          `0 0 0 1px rgba(${INK_SHADOW}, ${0.07 * shadow})`,
          `0 4px 10px rgba(${INK_SHADOW}, ${0.06 * shadow})`,
          `0 12px 28px rgba(${INK_SHADOW}, ${0.1 * shadow})`,
        ].join(', ');
}

function applyHideItemsProgress(items: HTMLElement[], t: number) {
  items.forEach((el) => {
    const local = gsap.utils.clamp(0, 1, (t - 0.08) / 0.5);
    const eased = easeMorph(local);

    if (eased >= 0.98) {
      el.style.display = 'none';
      el.style.opacity = '0';
      el.style.maxWidth = '';
      el.style.transform = '';
      el.dataset.navCompactCollapsed = 'true';
      el.setAttribute('aria-hidden', 'true');
      return;
    }

    el.style.display = '';
    el.style.overflow = 'hidden';
    el.style.whiteSpace = 'nowrap';
    el.style.opacity = String(1 - eased);
    el.style.maxWidth = `${Math.round((1 - eased) * 220)}px`;
    el.style.transform = `scale(${1 - eased * 0.06})`;
    el.style.pointerEvents = eased > 0.55 ? 'none' : '';
    el.style.visibility = eased > 0.92 ? 'hidden' : 'visible';
    delete el.dataset.navCompactCollapsed;
    el.removeAttribute('aria-hidden');
  });
}

function resetHideItems(items: HTMLElement[]) {
  items.forEach((el) => {
    el.style.opacity = '';
    el.style.transform = '';
    el.style.maxWidth = '';
    el.style.overflow = '';
    el.style.whiteSpace = '';
    el.style.pointerEvents = '';
    el.style.visibility = '';
    el.style.display = '';
    delete el.dataset.navCompactCollapsed;
    el.removeAttribute('aria-hidden');
  });
}

function applyNavGap(navList: HTMLUListElement | null, t: number) {
  if (!navList) return;
  navList.style.gap = `${gsap.utils.interpolate(28, 24)(t)}px`;
}

function applyInnerGap(inner: HTMLElement | null, t: number) {
  if (!inner) return;
  inner.style.gap = `${gsap.utils.interpolate(28, 16)(t)}px`;
}

function applyClusterCenter(
  cluster: HTMLElement | null,
  nav: HTMLElement | null,
  inner: HTMLElement | null,
  t: number,
) {
  if (!cluster) return;

  if (t < 0.04) {
    cluster.style.justifyContent = '';
    cluster.style.paddingLeft = '';
    cluster.style.paddingRight = '';
    cluster.style.gap = '';
    cluster.style.flex = '';
    if (nav) nav.style.flex = '';
    if (inner) inner.style.justifyContent = '';
    return;
  }

  cluster.style.flex = '0 1 auto';
  cluster.style.justifyContent = 'flex-start';
  cluster.style.paddingLeft = '0px';
  cluster.style.paddingRight = '0px';
  cluster.style.gap = `${gsap.utils.interpolate(24, 18)(t)}px`;
  if (nav) nav.style.flex = '0 0 auto';
  if (inner) inner.style.justifyContent = 'flex-start';
}

function applyLogoProgress(
  wordmark: HTMLElement | null,
  mark: HTMLElement | null,
  t: number,
  wordmarkWidth: number,
) {
  if (!wordmark || !mark) return;

  const lp = gsap.utils.clamp(0, 1, (t - 0.04) / 0.42);
  const le = easeMorph(lp);
  const markSize = 40;

  if (le < 0.02) {
    wordmark.style.width = '';
    wordmark.style.opacity = '';
    wordmark.style.visibility = '';
    wordmark.style.pointerEvents = '';
    wordmark.style.overflow = '';
    wordmark.querySelector('a')?.removeAttribute('tabindex');
    mark.style.width = '0px';
    mark.style.opacity = '0';
    mark.style.visibility = 'hidden';
    mark.style.pointerEvents = 'none';
    mark.setAttribute('aria-hidden', 'true');
    return;
  }

  wordmark.style.overflow = 'hidden';
  wordmark.style.width = `${Math.max(0, wordmarkWidth * (1 - le))}px`;
  wordmark.style.opacity = String(1 - le);
  wordmark.style.visibility = le > 0.95 ? 'hidden' : 'visible';
  wordmark.style.pointerEvents = le > 0.5 ? 'none' : 'auto';
  wordmark.querySelector('a')?.setAttribute('tabindex', le > 0.5 ? '-1' : '0');

  mark.style.overflow = 'hidden';
  mark.style.width = `${markSize * le}px`;
  mark.style.opacity = String(le);
  mark.style.visibility = le < 0.05 ? 'hidden' : 'visible';
  mark.style.pointerEvents = le > 0.5 ? 'auto' : 'none';
  mark.setAttribute('aria-hidden', le < 0.5 ? 'true' : 'false');
}

function setHideItemsCollapsed(items: HTMLElement[], collapsed: boolean) {
  items.forEach((el) => {
    if (collapsed) {
      el.dataset.navCompactCollapsed = 'true';
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    } else {
      delete el.dataset.navCompactCollapsed;
      el.style.display = '';
      el.removeAttribute('aria-hidden');
    }
  });
}

export function useNavScrollMorph(
  reducedMotion: boolean,
  refs: NavScrollMorphRefs,
  onProgress?: (progress: number) => void,
) {
  const [compactUi, setCompactUi] = useState(false);
  const [desktopMode, setDesktopMode] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(DESKTOP_MQ).matches,
  );
  const [mobileScrolled, setMobileScrolled] = useState(
    () => typeof window !== 'undefined' && window.scrollY > NAV_SCROLL_THRESHOLD,
  );
  const compactUiRef = useRef(false);
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
    if (!shell || !header) return;

    const wordmark = refs.wordmarkRef.current;
    const mark = refs.markRef.current;
    const navList = refs.navListRef.current;
    const inner = refs.innerRef.current;
    const cluster = header.querySelector<HTMLElement>('[data-nav-cluster]');
    const nav = navList?.parentElement ?? null;

    const isDesktop = () => desktopMode;

    const measureWordmark = () => {
      if (!wordmark) return;
      const prev = wordmark.style.opacity;
      wordmark.style.opacity = '1';
      wordmark.style.visibility = 'visible';
      wordmark.style.width = '';
      const w = Math.max(wordmark.scrollWidth, wordmark.getBoundingClientRect().width);
      wordmark.style.opacity = prev;
      if (w > 40) wordmarkWidthRef.current = w;
    };

    const applyFrame = (rawP: number) => {
      const t = easeMorph(gsap.utils.clamp(0, 1, rawP));
      const vw = window.innerWidth;
      const hideItems = gsap.utils.toArray<HTMLElement>('[data-nav-compact-hide]', header);

      applyHideItemsProgress(hideItems, t);
      applyNavGap(navList, t);
      applyInnerGap(inner, t);
      applyLogoProgress(wordmark, mark, t, wordmarkWidthRef.current);
      applyClusterCenter(cluster, nav, inner, t);
      const compactPadX = gsap.utils.interpolate(expandedPadX(vw), 8)(t);
      applyShellProgress(shell, t, vw, measureCompactWidth(inner, compactPadX, vw));

      const nextCompact = t > 0.72;
      if (nextCompact !== compactUiRef.current) {
        compactUiRef.current = nextCompact;
        setCompactUi(nextCompact);
      }
      onProgress?.(t);
    };

    const resetLogo = () => {
      if (wordmark) {
        wordmark.style.width = '';
        wordmark.style.opacity = '';
        wordmark.style.visibility = '';
        wordmark.style.pointerEvents = '';
        wordmark.style.overflow = '';
        wordmark.querySelector('a')?.removeAttribute('tabindex');
      }
      if (mark) {
        mark.style.width = '';
        mark.style.opacity = '';
        mark.style.visibility = '';
        mark.style.pointerEvents = '';
        mark.style.overflow = '';
        mark.setAttribute('aria-hidden', 'true');
      }
    };

    if (!isDesktop()) {
      ScrollTrigger.getById(SCROLL_TRIGGER_ID)?.kill();
      shell.style.cssText = '';
      shell.style.removeProperty('--nav-morph');
      resetLogo();
      if (navList) navList.style.gap = '';
      if (inner) inner.style.gap = '';
      applyClusterCenter(cluster, nav, inner, 0);
      return;
    }

    measureWordmark();

    if (reducedMotion) {
      ScrollTrigger.getById(SCROLL_TRIGGER_ID)?.kill();

      const applyReduced = () => {
        const rawP = window.scrollY > NAV_SCROLL_THRESHOLD ? 1 : 0;
        const hideItems = gsap.utils.toArray<HTMLElement>('[data-nav-compact-hide]', header);
        setHideItemsCollapsed(hideItems, rawP === 1);
        applyLogoProgress(wordmark, mark, rawP, wordmarkWidthRef.current);
        applyNavGap(navList, rawP);
        applyInnerGap(inner, rawP);
        applyClusterCenter(cluster, nav, inner, rawP);
        const vw = window.innerWidth;
        const compactPadX = gsap.utils.interpolate(expandedPadX(vw), 8)(rawP);
        applyShellProgress(shell, rawP, vw, measureCompactWidth(inner, compactPadX, vw));
        compactUiRef.current = rawP === 1;
        setCompactUi(rawP === 1);
        onProgress?.(rawP);
      };

      applyReduced();
      window.addEventListener('scroll', applyReduced, { passive: true });
      return () => window.removeEventListener('scroll', applyReduced);
    }

    const hideItems = gsap.utils.toArray<HTMLElement>('[data-nav-compact-hide]', header);

    const st = ScrollTrigger.create({
      id: SCROLL_TRIGGER_ID,
      start: 'top top',
      end: `+=${MORPH_SCROLL_DISTANCE}`,
      scrub: SCRUB_SMOOTHING,
      invalidateOnRefresh: true,
      onUpdate: (self) => applyFrame(self.progress),
    });

    applyFrame(st.progress);
    requestAnimationFrame(() => {
      measureWordmark();
      ScrollTrigger.refresh();
    });

    const mq = window.matchMedia(DESKTOP_MQ);
    const onResize = () => {
      measureWordmark();
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', onResize);
    mq.addEventListener('change', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      mq.removeEventListener('change', onResize);
      st.kill();
      resetHideItems(hideItems);
      shell.style.cssText = '';
      shell.style.removeProperty('--nav-morph');
      if (navList) navList.style.gap = '';
      if (inner) inner.style.gap = '';
      applyClusterCenter(cluster, nav, inner, 0);
      resetLogo();
    };
  }, [
    reducedMotion,
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
    const onScroll = () => {
      if (window.matchMedia(DESKTOP_MQ).matches) return;
      setMobileScrolled(window.scrollY > NAV_SCROLL_THRESHOLD);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const shell = refs.shellRef.current;
    if (!shell || window.matchMedia(DESKTOP_MQ).matches) return;
    shell.style.width = '100%';
    shell.style.maxWidth = 'none';
    shell.style.marginTop = '0';
    shell.style.borderRadius = '0';
    shell.style.minHeight = '';
    shell.style.paddingLeft = '';
    shell.style.paddingRight = '';
    shell.style.paddingTop = '';
    shell.style.paddingBottom = '';
    shell.style.display = '';
    shell.style.alignItems = '';
    shell.style.height = '';
    shell.style.overflow = '';
    shell.style.transition =
      'background-color 0.45s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.45s cubic-bezier(0.22, 1, 0.36, 1)';
    shell.style.backgroundColor = mobileScrolled ? 'rgba(255, 255, 255, 0.96)' : 'transparent';
    shell.style.boxShadow = mobileScrolled
      ? `0 1px 0 rgba(${INK_SHADOW}, 0.06), 0 8px 24px -12px rgba(${INK_SHADOW}, 0.08)`
      : 'none';
  }, [mobileScrolled, refs.shellRef]);

  return { compactUi, mobileScrolled };
}
