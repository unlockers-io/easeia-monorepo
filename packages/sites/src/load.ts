import { prisma, type Site } from "@repo/db";

import { SiteNotFoundError } from "./errors";

export const load = async (siteId: string): Promise<Site> => {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new SiteNotFoundError(siteId);
  }
  return site;
};
