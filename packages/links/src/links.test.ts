import { JobKind, LinkSource, LinkType, PostStatus, prisma, type SiteLanguage } from "@repo/db";
import { closeJobs, countJobs } from "@repo/jobs";
import * as Posts from "@repo/posts";
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import {
  approveSuggestion,
  approveSuggestions,
  countInternalInboundLinks,
  countPbnBacklinks,
  crawlPost,
  editSuggestionAnchor,
  isLiveLink,
  listSuggestions,
  networkLinkEdges,
  pbnBacklinkSummary,
  pruneFabricatedLinks,
  recentPbnBacklinks,
  rejectSuggestion,
  suggestForPost,
  suggestLink,
  SuggestionAppliedError,
  SuggestionNotFoundError,
} from "./index";

const run = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const domain = (name: string): string => `${name}-${run}.tld`;

const urlOf = (site: string, slug: string): string =>
  `https://${domain(site)}/sem-categoria/${slug}/`;

const similar = `[${Array.from({ length: 1536 }, () => 0.1).join(",")}]`;
const unrelated = `[${Array.from({ length: 1536 }, (_, i) => (i % 2 === 0 ? 1 : -1)).join(",")}]`;

const createSite = async (
  name: string,
  language: SiteLanguage,
  isEnabled = true,
): Promise<string> => {
  const site = await prisma.site.create({ data: { domain: domain(name), isEnabled, language } });

  return site.id;
};

const createPost = async (siteId: string, slug: string, body = "<p>Body.</p>"): Promise<string> => {
  const post = await prisma.post.create({
    data: {
      body,
      niches: ["WEDDING"],
      siteId,
      slug,
      status: PostStatus.PUBLISHED,
      title: `Title ${slug}`,
    },
  });

  return post.id;
};

const embed = (vector: string, ids: ReadonlyArray<string>) =>
  prisma.$executeRawUnsafe(`UPDATE "Post" SET embedding = $1::vector WHERE id = ANY($2)`, vector, [
    ...ids,
  ]);

const setBody = async (id: string, body: string): Promise<void> => {
  const post = await Posts.get(id);
  await Posts.reviseBody(id, { body, from: post.body });
};

const bodyOf = async (id: string): Promise<string> => {
  const post = await prisma.post.findUniqueOrThrow({ select: { body: true }, where: { id } });

  return post.body;
};

const inboundOf = async (id: string): Promise<number> => {
  const counts = await countInternalInboundLinks([id]);

  return counts.get(id) ?? 0;
};

const pendingIds = async (fromPostId: string): Promise<Array<string>> => {
  const rows = await listSuggestions({ fromPostId, limit: 50 });

  return rows.map((r) => r.id);
};

const withDatabaseAndRedis =
  process.env.TEST_DATABASE === "true" && process.env.TEST_REDIS === "true";

describe.runIf(withDatabaseAndRedis)("Link module", () => {
  const siteNames = ["alpha", "beta", "network", "off"];
  let alpha = "";
  let beta = "";
  let source = "";
  let sibling = "";
  let peer = "";

  const resetSites = async () => {
    const sites = { domain: { in: siteNames.map(domain) } };
    await prisma.job.deleteMany({ where: { post: { site: sites } } });
    await prisma.site.deleteMany({ where: sites });
    await prisma.moneySite.deleteMany({ where: { domain: domain("money") } });
  };

  beforeEach(async () => {
    await resetSites();
    alpha = await createSite("alpha", "PT");
    beta = await createSite("beta", "EN");
    const off = await createSite("off", "PT", false);
    source = await createPost(alpha, "source");
    sibling = await createPost(alpha, "sibling");
    peer = await createPost(beta, "peer");
    const disabledPeer = await createPost(off, "disabled-peer");
    await embed(similar, [source, sibling, peer, disabledPeer]);
  });

  afterAll(async () => {
    await resetSites();
    await closeJobs();
    await prisma.$disconnect();
  });

  const suggestFromSource = async () => {
    await suggestForPost(source);
    const rows = await listSuggestions({ fromPostId: source, limit: 50 });

    const to = (toPostId: string) => {
      const row = rows.find((r) => r.toPostId === toPostId);

      if (row === undefined) {
        throw new Error(`no suggestion to ${toPostId}`);
      }

      return row;
    };

    return { internal: to(sibling), pbn: to(peer) };
  };

  it("suggests same-Site INTERNAL and cross-Site PBN links from similar posts on enabled Sites", async () => {
    const unrelatedPost = await createPost(alpha, "unrelated");
    await embed(unrelated, [unrelatedPost]);

    expect(await suggestForPost(source)).toEqual({ internal: 1, pbn: 1 });
    const rows = await listSuggestions({ fromPostId: source, limit: 50 });
    expect(
      rows
        .map((r) => ({ toPostId: r.toPostId, toUrl: r.toUrl, type: r.type }))
        .toSorted((a, b) => a.type.localeCompare(b.type)),
    ).toEqual([
      { toPostId: sibling, toUrl: urlOf("alpha", "sibling"), type: LinkType.INTERNAL },
      { toPostId: peer, toUrl: urlOf("beta", "peer"), type: LinkType.PBN },
    ]);
  });

  it("keeps pending and rejected suggestions out of every live read", async () => {
    const { internal, pbn } = await suggestFromSource();
    await rejectSuggestion(pbn.id);

    expect(await inboundOf(sibling)).toBe(0);
    expect(await pbnBacklinkSummary(beta)).toEqual({
      backlinks: 0,
      referringPosts: 0,
      referringSites: 0,
    });
    expect(await recentPbnBacklinks(beta, 10)).toEqual([]);
    expect(await pendingIds(source)).toEqual([internal.id]);
    const { pbnEdges } = await networkLinkEdges();
    expect(pbnEdges.filter((e) => e.fromSiteId === alpha)).toEqual([]);
  });

  it("approve-and-apply writes the anchor into the source body and makes the link live", async () => {
    const before = await countPbnBacklinks();
    const { internal, pbn } = await suggestFromSource();

    const approved = await approveSuggestion(internal.id);
    await approveSuggestions(source, [pbn.id]);

    expect(isLiveLink(approved)).toBe(true);
    expect(await bodyOf(source)).toBe(
      [
        "<p>Body.</p>",
        "",
        "## Leia também",
        "",
        `- [Title sibling](${urlOf("alpha", "sibling")})`,
        `- [Title peer](${urlOf("beta", "peer")})`,
      ].join("\n"),
    );
    expect(await inboundOf(sibling)).toBe(1);
    expect(await countPbnBacklinks()).toBe(before + 1);
    expect(await pbnBacklinkSummary(beta)).toEqual({
      backlinks: 1,
      referringPosts: 1,
      referringSites: 1,
    });
    const backlinks = await recentPbnBacklinks(beta, 10);
    expect(backlinks.map((l) => l.fromPost.id)).toEqual([source]);
    const { pbnEdges } = await networkLinkEdges();
    expect(pbnEdges.filter((e) => e.fromSiteId === alpha)).toEqual([
      { count: 1, fromSiteId: alpha, toSiteId: beta },
    ]);
    expect(await pendingIds(source)).toEqual([]);
  });

  it("extends the see-also section in the Site's language and leaves present anchors alone", async () => {
    const english = await createPost(
      beta,
      "english",
      `Intro.\n\n## See also\n\n- [Old](https://x.tld/old/)\n\n## Notes\n\nKeep [${urlOf("beta", "present")}](${urlOf("beta", "present")}).`,
    );

    const present = await createPost(beta, "present");
    const toPeer = await suggestLink(english, peer);
    const toPresent = await suggestLink(english, present);
    await editSuggestionAnchor(toPeer.id, "Edited [anchor]");

    await approveSuggestions(english, [toPeer.id, toPresent.id]);

    expect(await bodyOf(english)).toBe(
      [
        "Intro.",
        "",
        "## See also",
        "",
        "- [Old](https://x.tld/old/)",
        String.raw`- [Edited \[anchor\]](${urlOf("beta", "peer")})`,
        "",
        "## Notes",
        "",
        `Keep [${urlOf("beta", "present")}](${urlOf("beta", "present")}).`,
      ].join("\n"),
    );
    expect(await inboundOf(present)).toBe(1);
  });

  it("approves anchors a revised body already carries without touching it again", async () => {
    const { internal } = await suggestFromSource();
    const inline = `Read the [sibling post](${internal.toUrl}).`;
    await setBody(source, inline);

    await approveSuggestions(source, [internal.id]);

    expect(await bodyOf(source)).toBe(inline);
    expect(await inboundOf(sibling)).toBe(1);
  });

  it("re-embeds and re-crawls a live post whose body an approval changed", async () => {
    const { internal } = await suggestFromSource();

    await approveSuggestion(internal.id);

    expect(await countJobs({ kinds: [JobKind.EMBED], postId: source })).toBe(1);
    expect(await countJobs({ kinds: [JobKind.CRAWL_LINKS], postId: source })).toBe(1);
  });

  it("refuses to reject or re-anchor a suggestion already in the body", async () => {
    const { internal } = await suggestFromSource();
    await approveSuggestion(internal.id);

    await expect(rejectSuggestion(internal.id)).rejects.toBeInstanceOf(SuggestionAppliedError);
    await expect(editSuggestionAnchor(internal.id, "Other")).rejects.toBeInstanceOf(
      SuggestionAppliedError,
    );
    expect(await inboundOf(sibling)).toBe(1);
  });

  it("returns the pending suggestion instead of suggesting the same pair twice", async () => {
    const { internal } = await suggestFromSource();

    const again = await suggestLink(source, sibling);
    await approveSuggestions(source, [again.id]);

    expect(again.id).toBe(internal.id);
    expect(await inboundOf(sibling)).toBe(1);
  });

  it("refuses to approve a suggestion that does not exist", async () => {
    await expect(approveSuggestion(`missing-${run}`)).rejects.toBeInstanceOf(
      SuggestionNotFoundError,
    );
  });

  it("crawls body anchors into classified, resolved links", async () => {
    const network = await createSite("network", "PT");
    const target = await createPost(network, "target");
    await setBody(
      source,
      [
        `[same site](/sem-categoria/sibling/)`,
        `<a href="https://www.${domain("network")}/c/target/">network</a>`,
        `<a href="https://elsewhere.tld/x">outside</a>`,
        `<a href="mailto:a@b.c">mail</a>`,
        `<a href="#top">top</a>`,
      ].join(" "),
    );

    expect(await crawlPost(source)).toEqual({ external: 1, internal: 1, pbn: 1, total: 3 });

    const rows = await prisma.link.findMany({
      orderBy: { position: "asc" },
      select: { source: true, toPostId: true, type: true },
      where: { fromPostId: source },
    });

    expect(rows).toEqual([
      { source: LinkSource.IMPORTED, toPostId: sibling, type: LinkType.INTERNAL },
      { source: LinkSource.IMPORTED, toPostId: target, type: LinkType.PBN },
      { source: LinkSource.IMPORTED, toPostId: null, type: LinkType.EXTERNAL },
    ]);
    expect(await inboundOf(sibling)).toBe(1);
  });

  it("prunes approved links whose anchor vanished and keeps pending suggestions", async () => {
    const { internal, pbn } = await suggestFromSource();
    await approveSuggestion(internal.id);
    expect(await inboundOf(sibling)).toBe(1);

    await setBody(source, "<p>Rewritten.</p>");
    await crawlPost(source);

    expect(await inboundOf(sibling)).toBe(0);
    expect(
      await prisma.link.findMany({ select: { id: true }, where: { fromPostId: source } }),
    ).toEqual([{ id: pbn.id }]);
  });

  it("replaces an approved suggestion with the crawled anchor that carries it", async () => {
    const { internal } = await suggestFromSource();
    await approveSuggestion(internal.id);
    await setBody(source, `<p><a href="${internal.toUrl}">sibling</a></p>`);

    await crawlPost(source);

    const rows = await prisma.link.findMany({
      select: { source: true },
      where: { fromPostId: source, toPostId: sibling },
    });

    expect(rows).toEqual([{ source: LinkSource.IMPORTED }]);
    expect(await inboundOf(sibling)).toBe(1);
  });

  it("strips anchors to posts that do not exist, keeping their text", async () => {
    const fake = urlOf("alpha", "fake");
    await createPost(alpha, "fake-2");
    const fakePrefix = urlOf("alpha", "fake-2");
    await setBody(
      source,
      [
        `See [guia](${fake}) and <a href="${fake}" rel="ugc">guide</a>.`,
        `[kept](${fakePrefix}) <a href="${urlOf("alpha", "sibling")}">real</a>`,
        `<a href="https://elsewhere.tld/x">outside</a>`,
      ].join("\n"),
    );

    expect(await pruneFabricatedLinks(source)).toEqual({ stripped: [fake] });
    expect(await bodyOf(source)).toBe(
      [
        "See guia and guide.",
        `[kept](${fakePrefix}) <a href="${urlOf("alpha", "sibling")}">real</a>`,
        `<a href="https://elsewhere.tld/x">outside</a>`,
      ].join("\n"),
    );
  });

  it("counts links into a money site by host", async () => {
    const money = await prisma.moneySite.create({
      data: { domain: domain("money"), name: "Money", sitemapUrl: "https://x.tld/sitemap.xml" },
    });

    await setBody(
      source,
      [
        `<a href="https://www.${domain("money")}/spaces/one/">one</a>`,
        `<a href="https://${domain("money")}.evil.tld/x">lookalike</a>`,
      ].join(" "),
    );
    await crawlPost(source);

    const { moneyEdges } = await networkLinkEdges();
    expect(moneyEdges.filter((e) => e.moneySiteId === money.id)).toEqual([
      { count: 1, fromSiteId: alpha, moneySiteId: money.id },
    ]);
  });
});
