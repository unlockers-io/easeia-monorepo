import { LinkSource, LinkType, prisma } from "@repo/db";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { crawlPost } from "./index";

const SUGGESTED_ANCHOR = "preserve-me";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("crawlPost preserves SUGGESTED links", () => {
  let siteId = "";
  let postIdA = "";
  let postIdB = "";

  beforeEach(async () => {
    const site = await prisma.site.create({
      data: {
        domain: `crawl-test-${Date.now()}.tld`,
      },
    });
    siteId = site.id;
    const a = await prisma.post.create({
      data: { body: `<p><a href="/post-b">to b</a></p>`, siteId, slug: "post-a", title: "A" },
    });
    const b = await prisma.post.create({
      data: { body: "<p>b body</p>", siteId, slug: "post-b", title: "B" },
    });
    postIdA = a.id;
    postIdB = b.id;
    await prisma.link.create({
      data: {
        anchorText: SUGGESTED_ANCHOR,
        fromPostId: postIdA,
        source: LinkSource.SUGGESTED,
        toPostId: postIdB,
        toUrl: "https://elsewhere.tld",
        type: LinkType.INTERNAL,
      },
    });
  });

  afterEach(async () => {
    await prisma.link.deleteMany({ where: { fromPostId: { in: [postIdA, postIdB] } } });
    await prisma.post.deleteMany({ where: { id: { in: [postIdA, postIdB] } } });
    await prisma.site.delete({ where: { id: siteId } });
  });

  it("does not delete SUGGESTED rows during recrawl", async () => {
    await crawlPost(postIdA);
    const remaining = await prisma.link.findMany({
      where: { fromPostId: postIdA, source: LinkSource.SUGGESTED },
    });
    expect(remaining).toHaveLength(1);
    expect(remaining[0]?.anchorText).toBe(SUGGESTED_ANCHOR);
  });
});
