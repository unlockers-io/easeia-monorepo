import { siteCreateSchema, type SiteCreateInput } from "@repo/api-types";
import { prisma, type Site } from "@repo/db";

import { SiteDomainTakenError } from "./errors";

export const createSite =
  (insert: (input: SiteCreateInput) => Promise<Site>) =>
  async (input: SiteCreateInput): Promise<Site> => {
    try {
      return await insert(siteCreateSchema.parse(input));
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        throw new SiteDomainTakenError();
      }
      throw error;
    }
  };

export const create = createSite((data) => prisma.site.create({ data }));
