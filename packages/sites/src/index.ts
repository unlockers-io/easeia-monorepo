import { sitePublicSchema, type SiteUpdatePatch as ApiSiteUpdatePatch } from "@repo/api-types";
import { prisma, type Site } from "@repo/db";

import { hasUsableDeployHook } from "./deploy-hook";
import { SiteDisabledError } from "./disabled-error";
import { SiteDeployHookMissingError, SiteNotFoundError } from "./errors";

export {
  type ExternalBacklinkRow,
  type ParseExternalBacklinksCsvOptions,
  type ParseExternalBacklinksCsvResult,
  parseExternalBacklinksCsv,
} from "./external-backlinks-csv";
export {
  type CategoryUrlConfig,
  DEFAULT_CATEGORY,
  postPath,
  postPublicUrl,
  slugify,
  toCategorySlugMap,
} from "./post-url";
export { SiteDisabledError } from "./disabled-error";
export { DomainError } from "./domain-error";
export { SiteDeployHookMissingError, SiteDomainTakenError, SiteNotFoundError } from "./errors";

export type SiteUpsertInput = {
  domain: string;
  isEnabled?: boolean;
  niches?: Site["niches"];
};

const requireSite = async (siteId: string): Promise<Site> => {
  const site = await prisma.site.findUnique({ where: { id: siteId } });
  if (!site) {
    throw new SiteNotFoundError(siteId);
  }
  return site;
};

export const load = (siteId: string): Promise<Site> => requireSite(siteId);

type FindSite = (siteId: string) => Promise<Site | null>;

const createRequireEnabled =
  (findSite: FindSite) =>
  async (siteId: string): Promise<Site> => {
    const site = await findSite(siteId);
    if (!site) {
      throw new SiteNotFoundError(siteId);
    }
    if (!site.isEnabled) {
      throw new SiteDisabledError(site.domain);
    }
    return site;
  };

const requireEnabled = createRequireEnabled((siteId) =>
  prisma.site.findUnique({ where: { id: siteId } }),
);

export const createRequirePublishable = (findSite: FindSite) => {
  const loadEnabled = createRequireEnabled(findSite);
  return async (siteId: string): Promise<Site> => {
    const site = await loadEnabled(siteId);
    if (!hasUsableDeployHook(site.vercelDeployHookUrl)) {
      throw new SiteDeployHookMissingError();
    }
    return site;
  };
};
export const requirePublishable = createRequirePublishable((siteId) =>
  prisma.site.findUnique({ where: { id: siteId } }),
);

export const find = (siteId: string): Promise<Site | null> =>
  prisma.site.findUnique({ where: { id: siteId } });

export const list = (): Promise<Array<Site>> =>
  prisma.site.findMany({ orderBy: { domain: "asc" } });

export const upsert = (input: SiteUpsertInput): Promise<Site> => {
  const data = {
    domain: input.domain,
    isEnabled: input.isEnabled ?? true,
    niches: input.niches ?? [],
  };
  return prisma.site.upsert({
    create: data,
    update: {
      isEnabled: input.isEnabled ?? true,
      niches: input.niches ?? [],
    },
    where: { domain: input.domain },
  });
};

export type SiteUpdatePatch = ApiSiteUpdatePatch &
  Partial<{
    categorySlugMap: Record<string, string>;
    defaultCategory: string;
    isEnabled: boolean;
    moneySiteId: string | null;
    niches: Site["niches"];
  }>;

export const update = (siteId: string, patch: SiteUpdatePatch): Promise<Site> =>
  prisma.site.update({
    data: patch,
    where: { id: siteId },
  });

/**
 * Cross-site (PBN) inbound Links. Returns the most recent N Links whose
 * target Post lives on the given Site. The Channel only renders.
 */
export type InboundLink = {
  anchorText: string;
  fromPost: {
    id: string;
    site: { domain: string; id: string };
    title: string;
  };
  id: string;
  toPost: { id: string; slug: string; title: string } | null;
};

export const inboundLinks = async (siteId: string, limit: number): Promise<Array<InboundLink>> => {
  const rows = await prisma.link.findMany({
    include: {
      fromPost: {
        select: {
          id: true,
          site: { select: { domain: true, id: true } },
          title: true,
        },
      },
      toPost: { select: { id: true, slug: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    where: {
      status: "ACTIVE",
      toPost: { siteId },
      type: "PBN",
    },
  });
  return rows.map((r) => ({
    anchorText: r.anchorText,
    fromPost: r.fromPost,
    id: r.id,
    toPost: r.toPost,
  }));
};

export const aggregateSiteNiches = async (siteId: string): Promise<Site["niches"]> => {
  const posts = await prisma.post.findMany({
    select: { niches: true },
    where: {
      niches: { isEmpty: false },
      siteId,
      status: "PUBLISHED",
    },
  });

  const counts = new Map<Site["niches"][number], number>();
  for (const post of posts) {
    for (const niche of post.niches) {
      counts.set(niche, (counts.get(niche) ?? 0) + 1);
    }
  }

  const top3 = [...counts.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([niche]) => niche);

  await prisma.site.update({ data: { niches: top3 }, where: { id: siteId } });

  return top3;
};

export { createRequireEnabled, requireEnabled };
export { hasUsableDeployHook, parseDeployHook } from "./deploy-hook";
export { create, createSite } from "./create";
export type { FindSite };

export const toPublic = (site: Site) =>
  sitePublicSchema.parse({ ...site, hasDeployHook: hasUsableDeployHook(site.vercelDeployHookUrl) });
