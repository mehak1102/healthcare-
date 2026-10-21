import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { cn } from '@/lib/cn';
import type { ConsultMode } from './hero-copy';
import { consultApiMode } from './hero-data';
import { ArrowIcon, CrosshairIcon, PinIcon, SearchIcon } from './hero-icons';
import { SuggestionsDropdown, type SuggestionRow } from './suggestions-dropdown';

type Copy = ReturnType<typeof import('./hero-copy').heroCopy>;

export function SearchBar({
  copy,
  mode,
  query,
  location,
  cities,
  groups,
  onQuery,
  onLocation,
}: {
  copy: Copy;
  mode: ConsultMode;
  query: string;
  location: string;
  cities: string[];
  groups: { group: string; items: SuggestionRow[] }[];
  onQuery: (value: string) => void;
  onLocation: (value: string) => void;
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const listId = 'hero-search-listbox';
  const inputRef = useRef<HTMLInputElement>(null);
  const cityId = 'hero-city-list';
  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  const directoryUrl = (override?: string) => {
    const q = (override ?? query).trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (location.trim() && location !== copy.currentLocation) params.set('city', location.trim());
    params.set('mode', consultApiMode(mode));
    params.set('takingBookings', '1');
    return `/doctors?${params.toString()}`;
  };

  const pick = (item: SuggestionRow) => {
    onQuery(item.fill);
    setOpen(false);
    inputRef.current?.blur();
    navigate(item.href ?? directoryUrl(item.fill));
  };

  const move = (delta: number) => {
    if (!flat.length) return;
    const index = flat.findIndex((item) => item.id === highlight);
    const start = index < 0 ? (delta > 0 ? -1 : 0) : index;
    const next = flat[(start + delta + flat.length) % flat.length];
    setHighlight(next.id);
  };

  const useGeo = () => {
    setGeoError(null);
    if (!navigator.geolocation) {
      setGeoError(copy.geoFailed);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${coords.latitude}&lon=${coords.longitude}`,
            { headers: { Accept: 'application/json' } },
          );
          const data = (await response.json()) as {
            address?: { city?: string; town?: string; village?: string; state?: string };
          };
          const found =
            data.address?.city ?? data.address?.town ?? data.address?.village ?? data.address?.state;
          onLocation(found || copy.currentLocation);
        } catch {
          setGeoError(copy.geoFailed);
        }
      },
      () => setGeoError(copy.geoFailed),
      { timeout: 6000 },
    );
  };

  const cityMatches = location.trim()
    ? cities.filter((city) => city.toLowerCase().includes(location.trim().toLowerCase())).slice(0, 8)
    : cities.slice(0, 8);

  return (
    <form
      className={cn(
        'hero-glass relative z-20 mx-auto w-full max-w-[800px] overflow-visible rounded-3xl p-2 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none max-sm:backdrop-blur-none',
        'focus-within:border-[var(--hero-tint-border)]',
      )}
      onSubmit={(event) => {
        event.preventDefault();
        const selected = flat.find((item) => item.id === highlight);
        if (open && selected) pick(selected);
        else navigate(directoryUrl());
      }}
    >
      <div className="flex items-stretch max-sm:flex-col max-sm:gap-2 sm:gap-0">
        <label className="relative min-w-0 flex-1 rounded-[16px] px-3 py-2 focus-within:bg-[var(--hero-tint-3)] max-sm:border max-sm:border-[var(--hero-border)] max-sm:bg-white max-sm:px-4">
          <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--hero-muted)]">
            <SearchIcon className="size-4 text-[var(--hero-indigo)]" />
            {copy.searchLabel}
          </span>
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={highlight ?? undefined}
            value={query}
            onChange={(event) => {
              onQuery(event.target.value);
              setOpen(true);
              setHighlight(null);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false);
                return;
              }
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setOpen(true);
                move(1);
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault();
                setOpen(true);
                move(-1);
              }
            }}
            placeholder={copy.searchPlaceholder}
            className="h-8 w-full bg-transparent text-[15px] text-[var(--hero-ink)] outline-none placeholder:text-[var(--hero-placeholder)]"
          />
          {open ? (
            <SuggestionsDropdown
              id={listId}
              groups={groups}
              highlight={highlight}
              emptyLabel={copy.noResults}
              onHighlight={setHighlight}
              onPick={pick}
            />
          ) : null}
        </label>

        <div className="mx-1 my-3 hidden w-px bg-[var(--hero-border)] sm:block" aria-hidden="true" />

        <label className="relative flex min-w-0 flex-1 items-end gap-2 rounded-[16px] px-3 py-2 focus-within:bg-[var(--hero-tint-3)] max-sm:border max-sm:border-[var(--hero-border)] max-sm:bg-white max-sm:px-4">
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-[var(--hero-muted)]">
              <PinIcon className="size-4 text-[var(--hero-indigo)]" />
              {mode === 'video' ? copy.locationLabelOptional : copy.locationLabel}
            </span>
            <input
              value={location}
              list={cityId}
              onChange={(event) => onLocation(event.target.value)}
              placeholder={mode === 'video' ? copy.locationPlaceholderVideo : copy.locationPlaceholder}
              className="h-8 w-full bg-transparent text-[15px] text-[var(--hero-ink)] outline-none placeholder:text-[var(--hero-placeholder)]"
            />
            <datalist id={cityId}>
              {cityMatches.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>
          </span>
          <button
            type="button"
            onClick={useGeo}
            aria-label={copy.useLocation}
            className="mb-0.5 grid size-11 shrink-0 place-items-center rounded-xl text-[var(--hero-indigo-dark)] hover:bg-[var(--hero-tint)] max-sm:bg-[var(--hero-tint-2)]"
          >
            <CrosshairIcon className="size-5" />
          </button>
        </label>

        <button
          type="submit"
          className="hero-btn-ink mt-0 h-[60px] shrink-0 px-6 text-[15px] max-sm:h-14 max-sm:w-full max-sm:rounded-[15px] sm:ml-2"
        >
          {copy.findCare}
          <ArrowIcon className="size-4" />
        </button>
      </div>
      {geoError ? <p className="px-3 pt-2 text-[12.5px] text-[var(--hero-emergency)]">{geoError}</p> : null}
    </form>
  );
}
