/**
 * Pairing logic, kept out of index.ts so it can be tested without a database.
 */

export type SuffixedCandidate = {
  body: string | null;
  id: string;
  siteId: string;
  slug: string;
};

export type SuffixedGroup<T> = { base: T; dupes: Array<T> };

/** WordPress appends a single digit when a slug collides on publish. */
const SUFFIX = /-\d$/u;

/**
 * Groups by base, not per copy: per-copy pairs each read the base's pre-run
 * body, so a `-3` copy could overwrite the longer body a `-2` copy moved.
 */
export const groupSuffixedPosts = <T extends SuffixedCandidate>(
  posts: ReadonlyArray<T>,
): Array<SuffixedGroup<T>> => {
  const bySlug = new Map(posts.map((post) => [`${post.siteId}::${post.slug}`, post]));
  const groups = new Map<string, SuffixedGroup<T>>();

  for (const dupe of posts) {
    if (!SUFFIX.test(dupe.slug)) {
      continue;
    }
    const base = bySlug.get(`${dupe.siteId}::${dupe.slug.replace(SUFFIX, "")}`);
    if (!base) {
      continue;
    }
    const group = groups.get(base.id) ?? { base, dupes: [] };
    group.dupes.push(dupe);
    groups.set(base.id, group);
  }

  return [...groups.values()];
};

/** The copy whose body survives onto the base slug. Ties keep the earliest. */
export const longestBody = <T extends { body: string | null }>(candidates: ReadonlyArray<T>): T =>
  candidates.reduce((best, post) =>
    (post.body ?? "").length > (best.body ?? "").length ? post : best,
  );
