"use server";

import { JobKind, prisma } from "@repo/db";
import { enqueue, fanoutRejections } from "@repo/jobs";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/auth-helpers";
import { redisUrl } from "@/lib/env";
import { log } from "@/lib/observability";

export type BackfillAllResult =
  | { error: string; ok: false }
  | { ok: true; queued: number; skipped: number };

export const startGscBacklinkBackfillAllAction = async (): Promise<BackfillAllResult> => {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated.", ok: false };
  }

  const connection = await prisma.googleConnection.findUnique({
    select: { id: true },
    where: { userId: session.user.id },
  });
  if (!connection) {
    return { error: "Connect Google in Settings before importing.", ok: false };
  }

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { id: true },
    where: { isEnabled: true },
  });
  if (sites.length === 0) {
    return { ok: true, queued: 0, skipped: 0 };
  }

  const results = await Promise.allSettled(
    sites.map((site) =>
      enqueue({
        kind: JobKind.BACKFILL_GSC_LINKS,
        payload: { siteId: site.id, userId: session.user.id },
        redisUrl: redisUrl(),
        siteId: site.id,
      }),
    ),
  );

  const rejections = fanoutRejections(results);
  for (const { index, reason } of rejections) {
    log.error({
      err: reason,
      message: "gsc-backfill-all: enqueue failed",
      siteId: sites[index]?.id,
    });
  }
  const skipped = rejections.length;
  const queued = results.length - skipped;

  revalidatePath("/dashboard/sites");
  return { ok: true, queued, skipped };
};
