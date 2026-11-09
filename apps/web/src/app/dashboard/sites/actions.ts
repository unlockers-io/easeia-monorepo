"use server";

import type { SiteCreateInput, SiteUpdatePatch } from "@repo/api-types";
import * as AutoPublish from "@repo/auto-publish";
import type { SiteLanguage } from "@repo/db";
import { importCsvBacklinks, requestGscBacklinkBackfill } from "@repo/links";
import * as Sites from "@repo/sites";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

import { authorPatchSchema, publishingPatchSchema } from "./[id]/patches";

export const createSiteAction = async (input: SiteCreateInput) =>
  withAuth(async () => {
    const site = await Sites.create(input);
    await audit({ action: "site.create", target: `site:${site.id}` });
    revalidatePath("/dashboard/sites");
    revalidatePath("/dashboard/posts/new");

    return site.id;
  });

export const updateSiteAction = async (id: string, patch: SiteUpdatePatch) =>
  withAuth(async () => {
    await Sites.update(id, patch);
    await audit({ action: "site.update", target: `site:${id}` });
    revalidatePath("/dashboard/sites");
  });

export const startGscBacklinkBackfillAllAction = async () =>
  withAuth(async () => {
    const sites = await Sites.listEnabled();
    const { queued } = await requestGscBacklinkBackfill(sites.map((site) => site.id));
    await audit({ action: "backlinks.backfill", meta: { queued }, target: "network" });

    return { alreadyRunning: sites.length - queued, queued };
  });

export const assignMoneySiteAction = async (siteId: string, moneySiteId: string | null) =>
  withAuth(async () => {
    await Sites.update(siteId, { moneySiteId });
    await audit({ action: "site.update", meta: { moneySiteId }, target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard");
  });

export const uploadExternalBacklinksAction = async (siteId: string, csvText: string) =>
  withAuth(async () => {
    const result = await importCsvBacklinks(siteId, csvText);
    await audit({ action: "backlinks.import", meta: result, target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);

    return result;
  });

export type UpdateAutoPublishInput = AutoPublish.AutoPublishInput & {
  language: SiteLanguage;
  topicHints: string | null;
};

export const updateAutoPublishAction = async (siteId: string, input: UpdateAutoPublishInput) =>
  withAuth(async () => {
    const { language, topicHints } = input;
    await AutoPublish.configure(siteId, input);
    await Sites.update(siteId, { language, topicHints });
    await audit({ action: "site.update", target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard/buckets");
  });

export const updateSiteAuthorAction = async (
  siteId: string,
  input: Pick<SiteUpdatePatch, "authorBio" | "authorName" | "authorPhotoUrl" | "authorUrl">,
) =>
  withAuth(async () => {
    await Sites.update(siteId, authorPatchSchema.parse(input));
    await audit({ action: "site.update", target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);
  });

export const updateSiteCadenceAction = async (siteId: string, cadenceDays: number | null) =>
  withAuth(async () => {
    await AutoPublish.setCadence(siteId, cadenceDays);
    await audit({ action: "site.update", target: `site:${siteId}` });
    revalidatePath("/dashboard/sites");
    revalidatePath(`/dashboard/sites/${siteId}`);
  });

export const startGscBacklinkBackfillAction = async (siteId: string) =>
  withAuth(async () => {
    await Sites.load(siteId);
    const result = await requestGscBacklinkBackfill([siteId]);
    await audit({ action: "backlinks.backfill", target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);

    return result;
  });

export const updateSitePublishingAction = async (
  siteId: string,
  input: Pick<
    SiteUpdatePatch,
    "astroRepoUrl" | "imageStyle" | "vercelDeployHookUrl" | "vercelProjectName"
  >,
) =>
  withAuth(async () => {
    await Sites.update(siteId, publishingPatchSchema.parse(input));
    await audit({ action: "site.update", target: `site:${siteId}` });
    revalidatePath(`/dashboard/sites/${siteId}`);
    revalidatePath("/dashboard/posts");
  });
