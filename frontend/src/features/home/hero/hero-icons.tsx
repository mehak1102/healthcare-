import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function icon(props: IconProps) {
  return {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    ...props,
  };
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 21s7-5.4 7-11a7 7 0 1 0-14 0c0 5.6 7 11 7 11Z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  );
}

export function CrosshairIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

export function ClinicIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M4 21V8l8-5 8 5v13" />
      <path d="M9 21v-7h6v7" />
      <path d="M10 11h4M12 9v4" />
    </svg>
  );
}

export function VideoIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="3" y="7" width="12" height="10" rx="2" />
      <path d="m15 11 6-3v8l-6-3" />
    </svg>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function ChevronIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function HelpIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.2 9.2a2.8 2.8 0 1 1 4.5 2.4c-.8.5-1.2 1-1.2 2" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M12 8v5" />
      <path d="M12 16h.01" />
      <path d="M10.2 4.8 2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.8 4.8a2 2 0 0 0-3.6 0Z" />
    </svg>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <svg {...icon(props)}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
