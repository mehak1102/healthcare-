import type { PipelineStage } from 'mongoose';

export const DIRECTORY_SORTS = ['name', 'next_available'] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

const NO_DATE = '9999-12-31';

/** Mongo stages to order listed doctors (null `nextAvailableDate` last). */
export function directorySortStages(sort: DirectorySort = 'name'): PipelineStage[] {
  if (sort === 'next_available') {
    return [
      { $addFields: { _nextSort: { $ifNull: ['$nextAvailableDate', NO_DATE] } } },
      { $sort: { _nextSort: 1, displayName: 1, _id: 1 } },
    ];
  }
  return [{ $sort: { displayName: 1, _id: 1 } }];
}

export function compareByNextAvailableDate(
  a: { slug: string; displayName: string; id?: string },
  b: { slug: string; displayName: string; id?: string },
  nextDateOf: (slug: string) => string | null | undefined,
): number {
  const da = nextDateOf(a.slug) ?? NO_DATE;
  const db = nextDateOf(b.slug) ?? NO_DATE;
  if (da !== db) return da.localeCompare(db);
  const byName = a.displayName.localeCompare(b.displayName, 'en-IN');
  if (byName !== 0) return byName;
  return (a.id ?? a.slug).localeCompare(b.id ?? b.slug);
}
