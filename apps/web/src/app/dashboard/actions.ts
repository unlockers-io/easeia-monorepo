"use server";

import { siteCreateSchema, siteUpdateFromFormData, type PostCreateInput } from "@repo/api-types";
import { Prisma } from "@repo/db";
import * as Posts from "@repo/posts";
import * as Sites from "@repo/sites";
import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import type { z } from "zod";

import { audit } from "@/lib/access";
import { requireSession } from "@/lib/auth-helpers";
import { sitePublishedPostsTag } from "@/lib/cache-tags";

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
  await audit({ action: "site.update", target: `site:${id}` });
  revalidatePath("/dashboard/sites");
};

const withError = (path: string, error: Sites.DomainError): string =>
  `${path}?error=${encodeURIComponent(error.message)}`;

export const createPostAction = async (
  input: PostCreateInput,
): Promise<{ id: string; ok: true } | { error: string; ok: false }> => {
  await requireSession();
  let result: Posts.CreateResult;
  try {
    result = await Posts.create(input);
  } catch (error) {
    if (error instanceof Sites.DomainError) {
      return { error: error.message, ok: false };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This site already has a post with that slug.", ok: false };
    }
    throw error;
  }
  await audit({ action: "post.create", target: `post:${result.post.id}` });
  revalidatePath("/dashboard/posts");
  return { id: result.post.id, ok: true };
};

export const publishPostAction = async (formData: FormData) => {
  await requireSession();
  const id = requiredId(formData);
  let result: Posts.PublishResult;
  try {
    result = await Posts.publish(id);
  } catch (error) {
    if (error instanceof Sites.DomainError) {
      redirect(withError(`/dashboard/posts/${id}`, error));
    }
    throw error;
  }
  await audit({ action: "post.publish", target: `post:${id}` });
  updateTag(sitePublishedPostsTag(result.post.siteId));
  revalidatePath(`/dashboard/posts/${id}`);
  revalidatePath("/dashboard/posts");
};

export const deletePostAction = async (formData: FormData) => {
  await requireSession();
  const id = requiredId(formData);
  const post = await Posts.remove(id);
  await audit({ action: "post.delete", target: `post:${id}` });
  updateTag(sitePublishedPostsTag(post.siteId));
  revalidatePath("/dashboard/posts");
  redirect("/dashboard/posts");
};

export const refreshSnapshotsAction = async () => {
  await requireSession();
  await Sites.requestSnapshots();
  await audit({ action: "snapshot.refresh", target: "network" });
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
    await audit({ action: "site.create", target: `site:${site.id}` });
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
