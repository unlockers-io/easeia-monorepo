import { JobKind, prisma } from "@repo/db";
import { enqueue, fanoutRejections } from "@repo/jobs";

import { log } from "./logger";

const startOfUtcDay = (d: Date): Date => {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
};

export const enqueueSnapshots = async (redisUrl: string): Promise<{ enqueued: number }> => {
  const today = startOfUtcDay(new Date());

  const sites = await prisma.site.findMany({
    select: { domain: true, id: true },
    where: {
      isEnabled: true,
      snapshots: {
        none: { date: today },
      },
    },
  });

  const results = await Promise.allSettled(
    sites.map((site) =>
      enqueue({
        kind: JobKind.SNAPSHOT_SITE,
        payload: { siteId: site.id },
        redisUrl,
        siteId: site.id,
      }),
    ),
  );

  const rejections = fanoutRejections(results);
  const failed = rejections.length;
  const enqueued = results.length - failed;
  for (const { index, reason } of rejections) {
    log.error({
      domain: sites[index]?.domain,
      err: reason,
      message: "snapshot-fanout: enqueue failed",
      siteId: sites[index]?.id,
    });
  }
  if (enqueued > 0 || failed > 0) {
    log.info({ enqueued, failed, message: "snapshot-fanout: tick", total: sites.length });
  }
  return { enqueued };
};
