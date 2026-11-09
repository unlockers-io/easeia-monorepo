import { prisma } from "@repo/db";
import { afterAll, describe, expect, it } from "vitest";

import { sourceDomainOf } from "./hosts";

import { externalBacklinkSummary, importCsvBacklinks, recordGscBacklinks } from "./index";

describe("sourceDomainOf", () => {
  it("keys a URL by its lowercased host without www", () => {
    expect(sourceDomainOf("https://Forbes.com/some/article?ref=1")).toBe("forbes.com");
    expect(sourceDomainOf("https://www.nytimes.com/a/b")).toBe("nytimes.com");
    expect(sourceDomainOf("https://blog.forbes.com/x")).toBe("blog.forbes.com");
    expect(sourceDomainOf("not-a-url")).toBeNull();
  });
});

describe.runIf(process.env.TEST_DATABASE === "true")("external backlinks", () => {
  let siteId = "";

  afterAll(async () => {
    await prisma.site.deleteMany({ where: { id: siteId } });
  });

  it("counts a referring domain once across CSV and Search Console imports", async () => {
    const site = await prisma.site.create({
      data: { domain: `backlinks-${crypto.randomUUID()}.test` },
    });

    siteId = site.id;

    const post = await prisma.post.create({
      data: { body: "b", siteId, slug: "post", title: "Post" },
    });

    await importCsvBacklinks(
      siteId,
      ["Site,Pages linking to your site", "forbes.com,3", "nytimes.com,1"].join("\n"),
    );

    const { domains } = await recordGscBacklinks(post, [
      "https://www.forbes.com/a",
      "https://forbes.com/b",
      "https://forbes.com/b",
      "not-a-url",
    ]);

    expect(domains).toBe(1);
    expect(
      await prisma.externalBacklink.findFirst({
        where: { siteId, source: "GSC_API", sourceDomain: "forbes.com" },
      }),
    ).toMatchObject({ linkingPages: 2 });
    expect(await externalBacklinkSummary(siteId)).toMatchObject({
      linkingPages: 4,
      referringDomains: 2,
    });
  });
});
