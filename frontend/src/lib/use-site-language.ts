import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { HeroLang } from '@/features/home/hero/hero-copy';

const STORAGE_KEY = 'sukoon-lang';
const LanguageContext = createContext<{
  lang: HeroLang;
  setLang: (lang: HeroLang) => void;
} | null>(null);

function readStored(): HeroLang {
  if (typeof window === 'undefined') return 'en';
  return window.localStorage.getItem(STORAGE_KEY) === 'hi' ? 'hi' : 'en';
}

export function SiteLanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<HeroLang>(readStored);

  useEffect(() => {
    document.documentElement.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    window.localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  const value = useMemo(
    () => ({
      lang,
      setLang: (next: HeroLang) => setLangState(next),
    }),
    [lang],
  );

  return createElement(LanguageContext.Provider, { value }, children);
}

export function useSiteLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useSiteLanguage must be used within SiteLanguageProvider');
  }
  return context;
}
