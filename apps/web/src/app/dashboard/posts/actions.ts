"use server";

import type { PostCreateInput } from "@repo/api-types";
import * as Posts from "@repo/posts";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

export const createPostAction = async (input: PostCreateInput) =>
  withAuth(async () => {
    const { post } = await Posts.create(input);
    await audit({ action: "post.create", target: `post:${post.id}` });
    revalidatePath("/dashboard/posts");

    return post.id;
  });

export const publishPostAction = async (id: string) =>
  withAuth(async () => {
    await Posts.publish(id);
    await audit({ action: "post.publish", target: `post:${id}` });
    revalidatePath(`/dashboard/posts/${id}`);
    revalidatePath("/dashboard/posts");
  });

export const deletePostAction = async (id: string) =>
  withAuth(async () => {
    await Posts.remove(id);
    await audit({ action: "post.delete", target: `post:${id}` });
    revalidatePath("/dashboard/posts");
  });

export const rewritePostAction = async (postId: string) =>
  withAuth(async () => {
    const job = await Posts.requestRewrite(postId, { force: true });
    await audit({ action: "rewrite.trigger", target: `post:${postId}` });

    return job;
  });
