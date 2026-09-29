import type { LinkType } from "@repo/db";

export type LinkRow = {
  anchorText: string;
  id: string;
  suggestedAt: Date | null;
  toPost: { id: string; slug: string; title: string } | null;
  toUrl: string;
  type: LinkType;
};

export const pickTopByRecencyAndType = (
  rows: ReadonlyArray<LinkRow>,
  limit: number,
): Array<LinkRow> => {
  const seenTargets = new Set<string>();
  const sorted = [...rows]
    .filter((r) => r.toPost !== null)
    .toSorted((a, b) => {
      const at = a.suggestedAt?.getTime() ?? 0;
      const bt = b.suggestedAt?.getTime() ?? 0;
      return bt - at;
    });
  const out: Array<LinkRow> = [];
  for (const r of sorted) {
    const tid = r.toPost?.id;
    if (tid === undefined || tid === "" || seenTargets.has(tid)) {
      continue;
    }
    seenTargets.add(tid);
    out.push(r);
    if (out.length >= limit) {
      break;
    }
  }
  return out;
};
