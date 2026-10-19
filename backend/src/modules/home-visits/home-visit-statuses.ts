export const HOME_VISIT_REQUEST_STATUSES = [
  'requested',
  'matching',
  'offered',
  'accepted',
  'en_route',
  'arrived',
  'completed',
  'unassigned',
  'cancelled',
] as const;

export type HomeVisitRequestStatus = (typeof HOME_VISIT_REQUEST_STATUSES)[number];

export const HOME_VISIT_ACTIVE_STATUSES: readonly HomeVisitRequestStatus[] = [
  'requested',
  'matching',
  'offered',
  'accepted',
  'en_route',
  'arrived',
];

export const HOME_VISIT_PREFERRED_WINDOWS = ['asap', 'morning', 'afternoon', 'evening'] as const;

export type HomeVisitPreferredWindow = (typeof HOME_VISIT_PREFERRED_WINDOWS)[number];

export const DISPATCH_OFFER_STATUSES = [
  'offered',
  'accepted',
  'declined',
  'expired',
  'withdrawn',
] as const;

export type DispatchOfferStatus = (typeof DISPATCH_OFFER_STATUSES)[number];

/** Pilot list price until doctor-specific home fees exist on profiles. */
export const HOME_VISIT_PILOT_QUOTE_FEE_MINOR = 149_900;

export const DISPATCH_OFFER_TTL_MINUTES = 30;
