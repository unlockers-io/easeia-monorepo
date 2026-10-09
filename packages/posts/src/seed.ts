import { type Prisma, prisma } from "@repo/db";
import * as Sites from "@repo/sites";

import { normalizeBody } from "./normalize-body";

export const recordSeedPost = async ({
  id,
  ...post
}: Prisma.PostUncheckedCreateInput & { id: string }): Promise<void> => {
  const { language } = await Sites.load(post.siteId);
  const data = { ...post, body: normalizeBody(post.body, language) };
  await prisma.post.upsert({ create: { id, ...data }, update: data, where: { id } });
};
