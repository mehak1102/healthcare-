import { AlertIcon, LockIcon } from './hero-icons';

export function ProofStrip({
  doctorCount,
  cityCount,
  soonest,
  doctorsLabel,
  citiesLabel,
  bookLabel,
  privateTitle,
  privateSub,
  emergency,
}: {
  doctorCount: number;
  cityCount: number;
  soonest: string | null;
  doctorsLabel: string;
  citiesLabel: string;
  bookLabel: string;
  privateTitle: string;
  privateSub: string;
  emergency: string;
}) {
  const cells = [
    { value: doctorCount > 0 ? String(doctorCount) : '—', label: doctorsLabel },
    { value: cityCount > 0 ? String(cityCount) : '—', label: citiesLabel },
    { value: soonest ?? '—', label: bookLabel },
    {
      value: (
        <span className="inline-flex items-center gap-2 text-[var(--hero-indigo)]">
          <LockIcon className="size-5" />
        </span>
      ),
      label: (
        <>
          {privateTitle}
          <span className="mt-1 block text-[13px] font-normal text-[var(--hero-muted)]">{privateSub}</span>
        </>
      ),
    },
  ];

  return (
    <div className="relative mx-auto mt-8 w-full max-w-[1180px] px-4 pb-2 sm:px-6">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-16 h-16 bg-gradient-to-b from-transparent to-white"
      />
      <div className="hero-glass grid grid-cols-2 overflow-hidden rounded-[20px] sm:grid-cols-4">
        {cells.map((cell, index) => (
          <div
            key={index}
            className="border-[var(--hero-border)] px-4 py-3.5 max-sm:border-b sm:border-r sm:last:border-r-0 max-sm:[&:nth-child(odd)]:border-r max-sm:[&:nth-last-child(-n+2)]:border-b-0"
          >
            <p className="text-[22px] font-semibold text-[var(--hero-indigo)] lg:text-[28px]">
              {cell.value}
            </p>
            <p className="mt-0.5 text-[13px] text-[var(--hero-body)]">{cell.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-start justify-center gap-2 text-left text-[13px] text-[var(--hero-muted)] max-sm:justify-start sm:text-center">
        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-[var(--hero-emergency-bg)] text-[var(--hero-emergency)]">
          <AlertIcon className="size-3" />
        </span>
        {emergency}
      </p>
    </div>
  );
}
