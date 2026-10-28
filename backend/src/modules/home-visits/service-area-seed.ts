/** Pilot Delhi + Gurugram PINs for `db:seed-service-areas` (synthetic; not a full coverage map). */
export const HOME_VISIT_SERVICE_AREA_SEED: {
  pinCode: string;
  stateCode: 'DL' | 'HR';
  label: string;
}[] = [
  { pinCode: '110001', stateCode: 'DL', label: 'New Delhi — GPO' },
  { pinCode: '110016', stateCode: 'DL', label: 'New Delhi — Hauz Khas' },
  { pinCode: '110064', stateCode: 'DL', label: 'New Delhi — RK Puram' },
  { pinCode: '110017', stateCode: 'DL', label: 'New Delhi — Lajpat Nagar' },
  { pinCode: '110085', stateCode: 'DL', label: 'New Delhi — Rohini' },
  { pinCode: '122001', stateCode: 'HR', label: 'Gurugram — Sector 14 / Old Gurgaon' },
  { pinCode: '122002', stateCode: 'HR', label: 'Gurugram — Civil Lines' },
  { pinCode: '122009', stateCode: 'HR', label: 'Gurugram — DLF Phase 1' },
];

/** @deprecated Use HOME_VISIT_SERVICE_AREA_SEED */
export const DELHI_SERVICE_AREA_SEED = HOME_VISIT_SERVICE_AREA_SEED;
