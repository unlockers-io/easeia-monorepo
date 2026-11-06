import { type Prisma, prisma, type Site } from "@repo/db";

import { SiteNotFoundError } from "./errors";

export const find = (siteId: string, tx: Prisma.TransactionClient = prisma): Promise<Site | null> =>
  tx.site.findUnique({ where: { id: siteId } });

export const load = async (
  siteId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Site> => {
  const site = await find(siteId, tx);

  if (!site) {
    throw new SiteNotFoundError(siteId);
  }

  return site;
};
