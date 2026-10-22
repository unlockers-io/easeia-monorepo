import { JobKind, JobStatus, prisma } from "@repo/db";
import { afterAll, describe, expect, it } from "vitest";

import { findLatestJobByPost } from "./index";

describe.runIf(process.env.TEST_DATABASE === "true")("findLatestJobByPost", () => {
  const run = `reads-${Date.now().toString(36)}`;
  let siteId = "";

  afterAll(async () => {
    await prisma.job.deleteMany({ where: { post: { siteId } } });
    await prisma.site.deleteMany({ where: { id: siteId } });
  });

  it("returns each post's newest Job and skips posts without one", async () => {
    const site = await prisma.site.create({ data: { domain: `${run}.test` } });
    siteId = site.id;

    const post = (slug: string) =>
      prisma.post.create({ data: { body: "b", siteId, slug, title: slug } });

    const [busy, idle] = await Promise.all([post("busy"), post("idle")]);

    const job = (createdAt: Date, status: JobStatus) =>
      prisma.job.create({
        data: { createdAt, kind: JobKind.PUBLISH, payload: {}, postId: busy.id, status },
      });

    await job(new Date(Date.now() - 60_000), JobStatus.DONE);
    const latest = await job(new Date(), JobStatus.FAILED);

    const jobs = await findLatestJobByPost([busy.id, idle.id]);

    expect(jobs.get(busy.id)?.id).toBe(latest.id);
    expect(jobs.has(idle.id)).toBe(false);
  });
});
