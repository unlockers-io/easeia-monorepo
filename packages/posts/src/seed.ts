import type { Prisma, PrismaClient } from "@repo/db";
import * as Sites from "@repo/sites";

import { normalizePostText } from "./transitions";

export const recordSeedPost = async (
  prisma: PrismaClient,
  { id, ...post }: Prisma.PostUncheckedCreateInput & { id: string },
): Promise<void> => {
  const { language } = await Sites.load(prisma, post.siteId);
  const data = { ...post, ...normalizePostText(post, language) };
  await prisma.post.upsert({ create: { id, ...data }, update: data, where: { id } });
};
