import { sitePublicSchema, type SiteUpdatePatch as ApiSiteUpdatePatch } from "@repo/api-types";
import { prisma, type Site } from "@repo/db";

import { parseDeployHook } from "./deploy-hook";
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

export const hasDeployHook = (site: Pick<Site, "vercelDeployHookUrl">): boolean =>
  parseDeployHook(site.vercelDeployHookUrl) !== null;

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
    if (!hasDeployHook(site)) {
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
  Partial<
    Pick<
      Site,
      | "authorBio"
      | "authorName"
      | "authorPhotoUrl"
      | "authorUrl"
      | "autoPublishEnabled"
      | "bucketRefillAt"
      | "bucketTarget"
      | "cadenceDays"
      | "lastAutoPublishedAt"
      | "moneySiteId"
      | "topicHints"
    >
  >;

export const update = (siteId: string, patch: SiteUpdatePatch): Promise<Site> =>
  prisma.site.update({
    data: patch,
    where: { id: siteId },
  });

type NetworkDefaults = {
  bucket: { refillAt: number; target: number } | null;
  cadenceDays: number | null;
  scope: "overwrite" | "unconfigured";
};

export const applyNetworkDefaults = (defaults: NetworkDefaults) =>
  prisma.$transaction(async (tx) => {
    const unconfigured = defaults.scope === "unconfigured";
    const cadence =
      defaults.cadenceDays === null
        ? { count: 0 }
        : await tx.site.updateMany({
            data: { autoPublishEnabled: true, cadenceDays: defaults.cadenceDays },
            where: unconfigured ? { cadenceDays: null, isEnabled: true } : { isEnabled: true },
          });
    const bucket =
      defaults.bucket === null
        ? { count: 0 }
        : await tx.site.updateMany({
            data: {
              bucketRefillAt: defaults.bucket.refillAt,
              bucketTarget: defaults.bucket.target,
            },
            where: unconfigured
              ? { bucketRefillAt: null, bucketTarget: null, isEnabled: true }
              : { isEnabled: true },
          });
    return { bucketSitesUpdated: bucket.count, cadenceSitesUpdated: cadence.count };
  });

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
export { load } from "./load";
export { create, createSite } from "./create";
export { deploy, requestRedeploy } from "./redeploy";
export type { FindSite };

export const toPublic = (site: Site) =>
  sitePublicSchema.parse({ ...site, hasDeployHook: hasDeployHook(site) });
