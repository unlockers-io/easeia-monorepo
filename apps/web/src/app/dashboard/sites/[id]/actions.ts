"use server";

import { siteUpdatePatchSchema } from "@repo/api-types";
import * as AutoPublish from "@repo/auto-publish";
import { AutoPublishConfigError } from "@repo/auto-publish";
import { ExternalBacklinkSource, JobKind, prisma, type SiteLanguage } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { isConnected } from "@repo/search-console";
import * as Sites from "@repo/sites";
import { parseExternalBacklinksCsv } from "@repo/sites";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { audit } from "@/lib/access";
import { requireSession } from "@/lib/auth-helpers";

export const assignMoneySiteAction = async (
  siteId: string,
  moneySiteId: string | null,
): Promise<void> => {
  await requireSession();
  await Sites.update(siteId, { moneySiteId });
  await audit({ action: "site.update", meta: { moneySiteId }, target: `site:${siteId}` });
  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath("/dashboard");
};

export type UploadExternalBacklinksResult = {
  imported: number;
  skipped: number;
};

export const uploadExternalBacklinksAction = async (
  siteId: string,
  csvText: string,
): Promise<UploadExternalBacklinksResult> => {
  await requireSession();

  const site = await prisma.site.findUnique({
    select: { domain: true, id: true },
    where: { id: siteId },
  });
  if (!site) {
    throw new Error("Site not found");
  }

  const { rows, skipped } = parseExternalBacklinksCsv(csvText, { selfDomain: site.domain });

  await prisma.$transaction(
    rows.map((row) =>
      prisma.externalBacklink.upsert({
        create: {
          linkingPages: row.linkingPages,
          siteId: site.id,
          source: ExternalBacklinkSource.CSV,
          sourceDomain: row.sourceDomain,
        },
        update: {
          importedAt: new Date(),
          linkingPages: row.linkingPages,
        },
        where: {
          siteId_sourceDomain_source: {
            siteId: site.id,
            source: ExternalBacklinkSource.CSV,
            sourceDomain: row.sourceDomain,
          },
        },
      }),
    ),
  );
  await audit({
    action: "backlinks.import",
    meta: { imported: rows.length, skipped },
    target: `site:${siteId}`,
  });

  revalidatePath(`/dashboard/sites/${siteId}`);

  return { imported: rows.length, skipped };
};

const clean = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

export type UpdateAutoPublishInput = {
  autoPublishEnabled: boolean;
  bucketRefillAt: number | null;
  bucketTarget: number | null;
  cadenceDays: number | null;
  language: SiteLanguage;
  topicHints: string | null;
};

export type UpdateAutoPublishResult = {
  errors: Array<string>;
};

export const updateAutoPublishAction = async (
  siteId: string,
  input: UpdateAutoPublishInput,
): Promise<UpdateAutoPublishResult> => {
  await requireSession();
  try {
    await AutoPublish.configure(siteId, {
      autoPublishEnabled: input.autoPublishEnabled,
      bucket: { refillAt: input.bucketRefillAt, target: input.bucketTarget },
      cadenceDays: input.cadenceDays,
    });
  } catch (error) {
    if (error instanceof AutoPublishConfigError) {
      return { errors: error.messages };
    }
    throw error;
  }
  await Sites.update(siteId, { language: input.language, topicHints: clean(input.topicHints) });
  await audit({ action: "site.update", target: `site:${siteId}` });
  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath("/dashboard/buckets");
  return { errors: [] };
};

export type UpdateSiteAuthorInput = {
  bio: string | null;
  name: string | null;
  photoUrl: string | null;
  url: string | null;
};

export const updateSiteAuthorAction = async (
  siteId: string,
  input: UpdateSiteAuthorInput,
): Promise<void> => {
  await requireSession();
  await Sites.update(siteId, {
    authorBio: clean(input.bio),
    authorName: clean(input.name),
    authorPhotoUrl: clean(input.photoUrl),
    authorUrl: clean(input.url),
  });
  await audit({ action: "site.update", target: `site:${siteId}` });
  revalidatePath(`/dashboard/sites/${siteId}`);
};

export const updateSiteCadenceAction = async (
  siteId: string,
  cadenceDays: number | null,
): Promise<void> => {
  await requireSession();
  await AutoPublish.configure(siteId, { autoPublishEnabled: cadenceDays !== null, cadenceDays });
  await audit({ action: "site.update", target: `site:${siteId}` });
  revalidatePath("/dashboard/sites");
  revalidatePath(`/dashboard/sites/${siteId}`);
};

export type StartGscBacklinkBackfillResult = { error: string; ok: false } | { ok: true };

export const startGscBacklinkBackfillAction = async (
  siteId: string,
): Promise<StartGscBacklinkBackfillResult> => {
  await requireSession();

  if (!(await isConnected())) {
    return { error: "Connect Google in Settings before importing.", ok: false };
  }

  const site = await prisma.site.findUnique({
    select: { id: true },
    where: { id: siteId },
  });
  if (!site) {
    return { error: "Site not found.", ok: false };
  }

  await enqueue({
    kind: JobKind.BACKFILL_GSC_LINKS,
    payload: { siteId: site.id },
    siteId: site.id,
  });
  await audit({ action: "backlinks.backfill", target: `site:${siteId}` });

  revalidatePath(`/dashboard/sites/${siteId}`);
  return { ok: true };
};

const publishingSettingsSchema = siteUpdatePatchSchema.pick({
  astroRepoUrl: true,
  imageStyle: true,
  vercelDeployHookUrl: true,
  vercelProjectName: true,
});

export const updateSitePublishingAction = async (
  siteId: string,
  input: z.input<typeof publishingSettingsSchema>,
): Promise<{ ok: true } | { error: string; ok: false }> => {
  await requireSession();
  const parsed = publishingSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the publishing settings.",
      ok: false,
    };
  }
  try {
    await Sites.update(siteId, parsed.data);
    await audit({ action: "site.update", target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard/posts");
    return { ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Sites.DomainError
          ? error.message
          : "Could not save publishing settings. Try again.",
      ok: false,
    };
  }
};
