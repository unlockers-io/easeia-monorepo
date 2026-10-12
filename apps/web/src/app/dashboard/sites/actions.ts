"use server";

import { JobKind, prisma } from "@repo/db";
import { enqueue, fanoutRejections } from "@repo/jobs";
import { isConnected } from "@repo/search-console";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { getSession } from "@/lib/auth-helpers";
import { log } from "@/lib/observability";

export type BackfillAllResult =
  | { error: string; ok: false }
  | { ok: true; queued: number; skipped: number };

export const startGscBacklinkBackfillAllAction = async (): Promise<BackfillAllResult> => {
  const session = await getSession();
  if (!session) {
    return { error: "Not authenticated.", ok: false };
  }

  if (!(await isConnected())) {
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
        payload: { siteId: site.id },
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
  await audit({ action: "backlinks.backfill", meta: { queued, skipped }, target: "network" });

  revalidatePath("/dashboard/sites");
  return { ok: true, queued, skipped };
};
