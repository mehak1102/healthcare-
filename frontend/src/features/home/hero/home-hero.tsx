import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { homeForRoles } from '@/features/auth/home-for-roles';
import type { Slot } from '@/features/appointments/api';
import { AppShowcase } from './app-showcase';
import { ConsultModeToggle } from './consult-mode-toggle';
import { heroCopy, type ConsultMode } from './hero-copy';
import { liveSuggestions } from './hero-data';
import { CheckIcon, ChevronIcon, UserIcon } from './hero-icons';
import { PopularChips } from './popular-chips';
import { ProofStrip } from './proof-strip';
import { SearchBar } from './search-bar';
import { useHeroLive } from './use-hero-live';
import { useSiteLanguage } from '@/lib/use-site-language';

export function HomeHero() {
  const { lang } = useSiteLanguage();
  const [mode, setMode] = useState<ConsultMode>('clinic');
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState('');
  const [slot, setSlot] = useState<Slot | null>(null);
  const copy = heroCopy(lang);
  const live = useHeroLive(mode, query, location, copy.currentLocation);
  const bookTo = live.user ? homeForRoles(live.user.roles) : '/register';

  useEffect(() => {
    setSlot(null);
  }, [live.featuredDoctor?.slug, mode]);

  useEffect(() => {
    setQuery('');
  }, [lang]);

  const groups = useMemo(
    () =>
      liveSuggestions({
        query,
        liveSpecialties: live.specialties,
        doctors: live.searchDoctors,
        lang,
        mode,
        labels: {
          popularSearches: copy.popularSearches,
          specialties: copy.specialties,
          doctors: copy.doctors,
          suggestedFor: copy.suggestedFor,
          symptomPrefix: copy.symptomPrefix,
        },
      }),
    [copy, lang, live.searchDoctors, live.specialties, mode, query],
  );

  return (
    <section data-sukoon-hero lang={copy.htmlLang} className="relative bg-white pt-2 pb-4 sm:pb-4">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="hero-grid absolute inset-0" />
        <div className="absolute top-[38%] left-[42%] size-[28rem] rounded-full bg-[#DCD8FF] opacity-90 blur-[90px]" />
        <div className="absolute top-[42%] right-[18%] size-[24rem] rounded-full bg-[#CDEBFF] opacity-85 blur-[90px]" />
        <div className="absolute bottom-[8%] left-1/2 size-[22rem] -translate-x-1/2 rounded-full bg-[#D3F5E4] opacity-80 blur-[80px]" />
        <div className="absolute right-[22%] bottom-[12%] size-[12rem] rounded-full bg-[#FFE1D3] opacity-80 blur-[80px]" />
      </div>

      <div className="relative mx-auto flex max-w-[900px] flex-col items-center gap-[22px] px-4 pt-2 sm:px-6">
        <Link
          to="/doctors?takingBookings=1"
          className="hero-glass hero-rise inline-flex h-11 items-center gap-2 rounded-full px-2 pr-3 text-[13.5px] text-[var(--hero-body)]"
          style={{ animationDelay: '0.05s' }}
        >
          <span className="inline-flex items-center gap-1 rounded-full bg-[var(--hero-tint)] px-2.5 py-1 text-[12.5px] font-semibold text-[var(--hero-indigo-dark)]">
            <CheckIcon className="size-3.5" />
            {copy.pillChip}
          </span>
          {copy.pillRest}
          <ChevronIcon className="size-3.5 text-[var(--hero-muted)]" />
        </Link>

        <h1
          className="hero-rise max-w-[900px] text-center font-semibold tracking-[-0.045em] text-[var(--hero-ink)]"
          style={{
            animationDelay: '0.15s',
            fontSize: lang === 'hi' ? 'clamp(38px, 5.8vw, 80px)' : 'clamp(44px, 6.4vw, 88px)',
            lineHeight: lang === 'hi' ? 1.25 : 1.02,
            fontWeight: lang === 'hi' ? 700 : 600,
          }}
        >
          {copy.h1Lead}
          <br />
          {copy.h1Prefix}
          <em
            lang={lang === 'hi' ? 'hi' : 'en'}
            className="not-italic text-[var(--hero-indigo)]"
            style={{
              fontFamily: lang === 'hi' ? "'Noto Serif Devanagari', serif" : 'var(--hero-serif)',
              fontStyle: lang === 'hi' ? 'normal' : 'italic',
              fontWeight: lang === 'hi' ? 500 : 400,
            }}
          >
            {copy.h1Emph}
          </em>
        </h1>

        <p
          className="hero-rise max-w-[560px] text-center text-[16.5px] leading-relaxed text-[var(--hero-body)] sm:text-[19px]"
          style={{ animationDelay: '0.25s' }}
        >
          {copy.sub}
        </p>

        <div className="hero-rise w-full text-center" style={{ animationDelay: '0.35s' }}>
          <ConsultModeToggle
            mode={mode}
            clinicLabel={copy.clinic}
            videoLabel={copy.video}
            onChange={(next) => {
              setMode(next);
              setSlot(null);
            }}
          />
        </div>

        <div className="hero-rise relative z-20 w-full" style={{ animationDelay: '0.45s' }}>
          <SearchBar
            copy={copy}
            mode={mode}
            query={query}
            location={location}
            cities={live.cities}
            groups={groups}
            onQuery={setQuery}
            onLocation={setLocation}
          />
        </div>

        <div className="hero-rise relative z-0 w-full" style={{ animationDelay: '0.55s' }}>
          <PopularChips
            specialties={live.specialties}
            popularLabel={copy.popular}
            help={copy.help}
            helpLink={copy.helpLink}
            onPick={setQuery}
          />
        </div>
      </div>

      <AppShowcase
        copy={copy}
        mode={mode}
        user={live.user}
        doctor={live.featuredDoctor}
        profile={live.profile}
        slots={live.openSlots}
        specialties={live.specialties}
        upcoming={live.upcoming}
        sessions={live.sessions}
        recordsMessage={live.recordsMessage}
        selectedSlot={slot}
        onSelectSlot={setSlot}
      />
      <ProofStrip
        doctorCount={live.doctorCount}
        cityCount={live.cityCount}
        soonest={live.soonestLabel}
        doctorsLabel={copy.statsDoctors}
        citiesLabel={copy.statsCities}
        bookLabel={copy.statsBook}
        privateTitle={copy.statsPrivate}
        privateSub={copy.statsPrivateSub}
        emergency={copy.emergency}
      />

      <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--hero-border)] bg-[rgb(255_255_255/0.88)] p-3 backdrop-blur-lg sm:hidden">
        <Link to={bookTo} className="hero-btn-ink h-[52px] flex-1 text-[15px]">
          {copy.bookDoctor}
        </Link>
        <Link
          to={live.user ? homeForRoles(live.user.roles) : '/login'}
          aria-label={copy.signIn}
          className="grid size-[52px] place-items-center rounded-[16px] border border-[var(--hero-border)] bg-white text-[var(--hero-ink)]"
        >
          <UserIcon className="size-5" />
        </Link>
      </div>
    </section>
  );
}
