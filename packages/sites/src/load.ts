import type { Prisma, Site } from "@repo/db";

import { SiteNotFoundError } from "./errors";

export const find = (tx: Prisma.TransactionClient, siteId: string): Promise<Site | null> =>
  tx.site.findUnique({ where: { id: siteId } });

export const load = async (tx: Prisma.TransactionClient, siteId: string): Promise<Site> => {
  const site = await find(tx, siteId);

  if (!site) {
    throw new SiteNotFoundError(siteId);
  }

  return site;
};
