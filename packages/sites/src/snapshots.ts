import { JobKind, prisma } from "@repo/db";
import { enqueueUnlessInFlight } from "@repo/jobs";

const startOfUtcDay = (date: Date): Date => {
  const day = new Date(date);
  day.setUTCHours(0, 0, 0, 0);
  return day;
};

export const requestSnapshots = async (now = new Date()): Promise<{ queued: number }> => {
  const sites = await prisma.site.findMany({
    select: { id: true },
    where: { isEnabled: true, snapshots: { none: { date: startOfUtcDay(now) } } },
  });
  const jobs = await Promise.all(
    sites.map((site) =>
      enqueueUnlessInFlight({
        kind: JobKind.SNAPSHOT_SITE,
        payload: { siteId: site.id },
        siteId: site.id,
      }),
    ),
  );
  return { queued: jobs.filter((job) => job !== null).length };
};
