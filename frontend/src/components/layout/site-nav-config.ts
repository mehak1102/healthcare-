export const SERVICE_LINKS = [
  { to: '/doctor-at-home', label: 'Doctor at Home' },
  { to: '/online-consultation', label: 'Online Consultation' },
  { to: '/diagnostics', label: 'Diagnostics & Lab Tests' },
  { to: '/home-healthcare', label: 'Home Healthcare' },
] as const;

export const PRIMARY_NAV_LINKS = [
  { to: '/', label: 'Home', end: true, hideInCompact: true },
  { to: '/doctors', label: 'Find Doctors', compactLabel: 'Doctors' },
  { to: '/health-packages', label: 'Health Packages', compactLabel: 'Packages' },
  { to: '/health-library', label: 'Health Library', hideInCompact: true },
  { to: '/about', label: 'About Us' },
] as const;

export function navLinkHidesInCompact(item: (typeof PRIMARY_NAV_LINKS)[number]): boolean {
  return 'hideInCompact' in item && item.hideInCompact === true;
}

export function isServicesPath(pathname: string): boolean {
  return SERVICE_LINKS.some((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
}
