"use server";

import { siteCreateSchema, postCreateFromFormData, siteUpdateFromFormData } from "@repo/api-types";
import { JobKind, prisma } from "@repo/db";
import { enqueue } from "@repo/jobs";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { requireSession } from "@/lib/auth-helpers";
import { sitePublishedPostsTag } from "@/lib/cache-tags";
import { redisUrl } from "@/lib/env";

const requiredId = (formData: FormData) => {
  const id = formData.get("id");
  if (typeof id !== "string" || id === "") {
    throw new Error("id is required");
  }
  return id;
};

export const updateSiteAction = async (formData: FormData) => {
  await requireSession();
  const { id, patch } = siteUpdateFromFormData(formData);
  await Sites.update(id, patch);
  revalidatePath("/dashboard/sites");
};

export const createPostAction = async (formData: FormData) => {
  await requireSession();
  const data = postCreateFromFormData(formData);
  let result: Posts.CreateResult;
  try {
    result = await Posts.create(data, { redisUrl: redisUrl() });
  } catch (error) {
    if (!(error instanceof Sites.SiteDeployHookMissingError)) {
      throw error;
    }
    result = await Posts.create({ ...data, publish: false }, { redisUrl: redisUrl() });
    revalidatePath("/dashboard/posts");
    redirect(`/dashboard/posts/${result.post.id}?error=deploy-hook`);
  }
  revalidatePath("/dashboard/posts");
  redirect(`/dashboard/posts/${result.post.id}`);
};

export const publishPostAction = async (formData: FormData) => {
  await requireSession();
  const id = requiredId(formData);
  let result: Posts.PublishResult;
  try {
    result = await Posts.publish(id, { redisUrl: redisUrl() });
  } catch (error) {
    if (error instanceof Sites.SiteDeployHookMissingError) {
      redirect(`/dashboard/posts/${id}?error=deploy-hook`);
    }
    throw error;
  }
  const { post } = result;
  updateTag(sitePublishedPostsTag(post.siteId));
  revalidatePath(`/dashboard/posts/${id}`);
  revalidatePath("/dashboard/posts");
};

export const deletePostAction = async (formData: FormData) => {
  await requireSession();
  const id = requiredId(formData);
  const post = await prisma.post.findUnique({ select: { siteId: true }, where: { id } });
  await Posts.remove(id);
  if (post) {
    updateTag(sitePublishedPostsTag(post.siteId));
  }
  revalidatePath("/dashboard/posts");
  redirect("/dashboard/posts");
};

export const refreshSnapshotsAction = async () => {
  await requireSession();
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const sites = await prisma.site.findMany({
    select: { id: true },
    where: {
      isEnabled: true,
      snapshots: { none: { date: today } },
    },
  });

  await Promise.allSettled(
    sites.map((site) =>
      enqueue({
        kind: JobKind.SNAPSHOT_SITE,
        payload: { siteId: site.id },
        redisUrl: redisUrl(),
        siteId: site.id,
      }),
    ),
  );

  revalidatePath("/dashboard");
};

export const createSiteAction = async (
  input: z.input<typeof siteCreateSchema>,
): Promise<{ id: string; ok: true } | { error: string; ok: false }> => {
  await requireSession();
  const parsed = siteCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the site details.", ok: false };
  }
  try {
    const site = await Sites.create(parsed.data);
    revalidatePath("/dashboard/sites");
    revalidatePath("/dashboard/posts/new");
    return { id: site.id, ok: true };
  } catch (error) {
    return {
      error:
        error instanceof Sites.DomainError
          ? error.message
          : "Could not create the site. Try again.",
      ok: false,
    };
  }
};
