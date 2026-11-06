import type { BuildAuthor } from "@easeia/astro-content";
import {
  siteCreateSchema,
  siteDomainSchema,
  sitePublicSchema,
  siteUpdatePatchSchema,
  type SiteCreateInput,
  type SiteUpdatePatch,
} from "@repo/api-types";
import { Prisma, prisma, type Site } from "@repo/db";

import { parseDeployHook } from "./deploy-hook";
import { SiteDisabledError } from "./disabled-error";
import {
  SiteDeployHookMissingError,
  SiteDomainTakenError,
  SiteMoneySiteNotFoundError,
  SiteNotFoundError,
} from "./errors";
import { load } from "./load";
import { requestRedeploy } from "./redeploy";

export { postPath, postPublicUrl, slugify, toCategorySlugMap } from "./post-url";

export { SiteDisabledError } from "./disabled-error";

export { SiteDeployHookMissingError, SiteDomainTakenError, SiteNotFoundError } from "./errors";

export type { SiteUpdatePatch } from "@repo/api-types";

export const hasDeployHook = (site: Pick<Site, "vercelDeployHookUrl">): boolean =>
  parseDeployHook(site.vercelDeployHookUrl) !== null;

export const isDeployable = (site: Pick<Site, "isEnabled" | "vercelDeployHookUrl">): boolean =>
  site.isEnabled && hasDeployHook(site);

export { find, load } from "./load";

export const requireEnabled = async (
  siteId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Site> => {
  const site = await load(siteId, tx);

  if (!site.isEnabled) {
    throw new SiteDisabledError(site.domain);
  }

  return site;
};

export const requirePublishable = async (
  siteId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<Site> => {
  const site = await requireEnabled(siteId, tx);

  if (!hasDeployHook(site)) {
    throw new SiteDeployHookMissingError();
  }

  return site;
};

export const list = (): Promise<Array<Site>> =>
  prisma.site.findMany({ orderBy: { domain: "asc" } });

export const listEnabled = () =>
  prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, id: true },
    where: { isEnabled: true },
  });

const writing = async <T>(write: () => Promise<T>): Promise<T> => {
  try {
    return await write();
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new SiteDomainTakenError();
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new SiteMoneySiteNotFoundError();
    }

    throw error;
  }
};

export const create = (input: SiteCreateInput): Promise<Site> =>
  writing(() => prisma.site.create({ data: siteCreateSchema.parse(input) }));

export const ensure = async (domain: string, niches: Site["niches"] = []): Promise<Site> => {
  const normalized = siteDomainSchema.parse(domain);

  return prisma.site.upsert({
    create: { domain: normalized, niches },
    update: {},
    where: { domain: normalized },
  });
};

export const buildAuthor = (
  site: Pick<Site, "authorBio" | "authorName" | "authorPhotoUrl" | "authorUrl">,
): BuildAuthor | null =>
  site.authorName === null || site.authorName === ""
    ? null
    : {
        bio: site.authorBio,
        name: site.authorName,
        photoUrl: site.authorPhotoUrl,
        url: site.authorUrl,
      };

const buildProjection = (site: Site): string =>
  JSON.stringify([site.domain, site.language, buildAuthor(site)]);

export const update = (siteId: string, input: SiteUpdatePatch): Promise<Site> => {
  const patch = siteUpdatePatchSchema.parse(input);

  return writing(() =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT id FROM "Site" WHERE id = ${siteId} FOR UPDATE`;
      const before = await tx.site.findUnique({ where: { id: siteId } });

      if (before === null) {
        throw new SiteNotFoundError(siteId);
      }

      const site = await tx.site.update({ data: patch, where: { id: siteId } });

      if (buildProjection(before) !== buildProjection(site)) {
        await requestRedeploy(siteId, tx);
      }

      return site;
    }),
  );
};

type Schedule = Partial<
  Pick<
    Site,
    "autoPublishEnabled" | "bucketRefillAt" | "bucketTarget" | "cadenceDays" | "lastAutoPublishedAt"
  >
>;

export const updateSchedule = (
  siteId: string,
  schedule: Schedule,
  tx: Prisma.TransactionClient = prisma,
): Promise<Site> => tx.site.update({ data: schedule, where: { id: siteId } });

export const updateEnabledSchedules = async (
  schedule: Schedule,
  where: Pick<Prisma.SiteWhereInput, "bucketRefillAt" | "bucketTarget" | "cadenceDays">,
  tx: Prisma.TransactionClient,
): Promise<number> => {
  const { count } = await tx.site.updateMany({
    data: schedule,
    where: { ...where, isEnabled: true },
  });

  return count;
};

export { deploy, requestRedeploy } from "./redeploy";

export { requestSnapshots, snapshotDay } from "./snapshots";

export const toPublic = (site: Site) =>
  sitePublicSchema.parse({ ...site, hasDeployHook: hasDeployHook(site) });
