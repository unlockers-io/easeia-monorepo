"use server";

import { prisma } from "@repo/db";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-helpers";

import { createApiKeyActions } from "./api-key-actions";

const requireSession = async (): Promise<void> => {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
};

const { createApiKeyAction, revokeApiKeyAction } = createApiKeyActions({
  createKey: (data) => prisma.apiKey.create({ data }),
  requireSession,
  revalidate: revalidatePath,
  revokeKey: async (id) => {
    await prisma.apiKey.update({ data: { revokedAt: new Date() }, where: { id } });
  },
});

export { createApiKeyAction, revokeApiKeyAction };
