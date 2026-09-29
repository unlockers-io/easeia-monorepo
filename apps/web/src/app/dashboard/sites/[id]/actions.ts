"use server";

import { siteUpdatePatchSchema } from "@repo/api-types";
import { ExternalBacklinkSource, JobKind, prisma, type SiteLanguage } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { bucketConfigErrors } from "@repo/posts";
import * as Sites from "@repo/sites";
import { parseExternalBacklinksCsv } from "@repo/sites";
import { revalidatePath } from "next/cache";
import type { z } from "zod";

import { requireSession } from "@/lib/auth-helpers";
import { redisUrl } from "@/lib/env";

export const assignMoneySiteAction = async (
  siteId: string,
  moneySiteId: string | null,
): Promise<void> => {
  await requireSession();
  await prisma.site.update({
    data: { moneySiteId },
    where: { id: siteId },
  });
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

  revalidatePath(`/dashboard/sites/${siteId}`);

  return { imported: rows.length, skipped };
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
  warnings: Array<string>;
};

const sanitizeInt = (raw: number | null, max: number): number | null => {
  if (raw === null || Number.isNaN(raw)) {
    return null;
  }
  return Math.max(1, Math.min(max, Math.floor(raw)));
};

export const updateAutoPublishAction = async (
  siteId: string,
  input: UpdateAutoPublishInput,
): Promise<UpdateAutoPublishResult> => {
  await requireSession();

  const errors: Array<string> = [];
  const warnings: Array<string> = [];

  const cadence = sanitizeInt(input.cadenceDays, 365);
  const target = sanitizeInt(input.bucketTarget, 100);
  const rawRefill = sanitizeInt(input.bucketRefillAt, 100);

  if (input.autoPublishEnabled && cadence === null) {
    errors.push("Cadence is required when auto-publish is enabled.");
  }

  if ((target === null) !== (rawRefill === null)) {
    errors.push("Set both bucket target and refill threshold, or leave both blank.");
  }

  if (target !== null && rawRefill !== null) {
    errors.push(...bucketConfigErrors({ refillAt: rawRefill, target }));
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  const bucketTarget = target;
  const bucketRefillAt = rawRefill;
  const hints =
    input.topicHints !== null && input.topicHints.trim().length > 0
      ? input.topicHints.trim()
      : null;

  if (input.autoPublishEnabled && cadence === null) {
    warnings.push("Auto-publish disabled because cadence is missing.");
  }

  await prisma.site.update({
    data: {
      autoPublishEnabled: input.autoPublishEnabled && cadence !== null,
      bucketRefillAt,
      bucketTarget,
      cadenceDays: cadence,
      language: input.language,
      topicHints: hints,
    },
    where: { id: siteId },
  });
  revalidatePath(`/dashboard/sites/${siteId}`);
  revalidatePath("/dashboard/buckets");
  return { errors, warnings };
};

export type UpdateSiteAuthorInput = {
  bio: string | null;
  name: string | null;
  photoUrl: string | null;
  url: string | null;
};

const clean = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
};

export const updateSiteAuthorAction = async (
  siteId: string,
  input: UpdateSiteAuthorInput,
): Promise<void> => {
  await requireSession();
  await prisma.site.update({
    data: {
      authorBio: clean(input.bio),
      authorName: clean(input.name),
      authorPhotoUrl: clean(input.photoUrl),
      authorUrl: clean(input.url),
    },
    where: { id: siteId },
  });
  revalidatePath(`/dashboard/sites/${siteId}`);
};

export const updateSiteCadenceAction = async (
  siteId: string,
  cadenceDays: number | null,
): Promise<void> => {
  await requireSession();
  const cadence =
    cadenceDays === null || Number.isNaN(cadenceDays)
      ? null
      : Math.max(1, Math.min(365, Math.floor(cadenceDays)));
  await prisma.site.update({
    data: {
      autoPublishEnabled: cadence !== null,
      cadenceDays: cadence,
    },
    where: { id: siteId },
  });
  revalidatePath("/dashboard/sites");
  revalidatePath(`/dashboard/sites/${siteId}`);
};

export type StartGscBacklinkBackfillResult = { error: string; ok: false } | { ok: true };

export const startGscBacklinkBackfillAction = async (
  siteId: string,
): Promise<StartGscBacklinkBackfillResult> => {
  const session = await requireSession();

  const connection = await prisma.googleConnection.findUnique({
    select: { id: true },
    where: { userId: session.user.id },
  });
  if (!connection) {
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
    payload: { siteId: site.id, userId: session.user.id },
    redisUrl: redisUrl(),
    siteId: site.id,
  });

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
