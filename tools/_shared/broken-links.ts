import { readFileSync, writeFileSync } from "node:fs";

import { z } from "zod";

export type BrokenLink = {
  anchorText: string;
  fromPostId: string;
  fromSiteDomain: string;
  fromSlug: string;
  fromTitle: string;
  rawHref: string;
  targetCategorySlug: string;
  targetSiteDomain: string;
  targetSlug: string;
};

export const BROKEN_LINKS_FILE = "/tmp/easeia-broken-links.json";

const brokenLinkSchema: z.ZodType<BrokenLink> = z.object({
  anchorText: z.string(),
  fromPostId: z.string(),
  fromSiteDomain: z.string(),
  fromSlug: z.string(),
  fromTitle: z.string(),
  rawHref: z.string(),
  targetCategorySlug: z.string(),
  targetSiteDomain: z.string(),
  targetSlug: z.string(),
});
const brokenLinksSchema = z.array(brokenLinkSchema);

export const writeBrokenLinks = (rows: ReadonlyArray<BrokenLink>): void => {
  writeFileSync(BROKEN_LINKS_FILE, JSON.stringify(rows, null, 2));
};

export const readBrokenLinks = (): Array<BrokenLink> => {
  return brokenLinksSchema.parse(JSON.parse(readFileSync(BROKEN_LINKS_FILE, "utf8")));
};
