export const FEE_BANDS = ['free', 'under_500', 'under_1000', 'under_2000'] as const;
export type FeeBand = (typeof FEE_BANDS)[number];

/** Mongo match on `consultationFeeInr` for a directory fee band. */
export function consultationFeeMatch(band: FeeBand): Record<string, unknown> {
  switch (band) {
    case 'free':
      return { consultationFeeInr: 0 };
    case 'under_500':
      return { consultationFeeInr: { $ne: null, $lte: 500 } };
    case 'under_1000':
      return { consultationFeeInr: { $ne: null, $lte: 1000 } };
    case 'under_2000':
      return { consultationFeeInr: { $ne: null, $lte: 2000 } };
  }
}
