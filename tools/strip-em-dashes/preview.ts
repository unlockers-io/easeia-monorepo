import { prisma, type SiteLanguage } from "@repo/db";
import { stripEmDash } from "@repo/posts";

import type { Change } from "./report";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36";

const FETCH_TIMEOUT_MS = 30_000;
const CONCURRENCY = 12;

const get = async (url: string): Promise<string | null> => {
  try {
    const res = await fetch(url, {
      headers: { "user-agent": UA },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
};

const decodeEntities = (s: string): string =>
  s
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&nbsp;", String.fromCodePoint(160))
    .replaceAll("&amp;", "&");

const tag = (block: string, name: string): string => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  if (m === null) {
    return "";
  }
  const [, inner] = m;
  if (inner === undefined) {
    throw new Error(`tag: <${name}> matched without its capture group`);
  }
  return decodeEntities(inner);
};

const slugOf = (url: string): string => url.replace(/\/$/, "").split("/").pop() ?? url;

const mapLimit = async <T>(items: Array<T>, fn: (item: T) => Promise<void>): Promise<void> => {
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (item !== undefined) {
        await fn(item);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
};

export const collectPreviewChanges = async (): Promise<{
  changes: Array<Change>;
  scanned: number;
}> => {
  const changes: Array<Change> = [];
  const items: Array<{
    excerpt: string;
    language: SiteLanguage;
    site: string;
    title: string;
    url: string;
  }> = [];

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true, language: true },
    where: { isEnabled: true },
  });
  await mapLimit(sites, async ({ domain: site, language }) => {
    const rss = await get(`https://${site}/rss.xml`);
    if (rss === null) {
      console.error(`  ${site}: rss.xml unreachable`);
      return;
    }
    for (const block of rss.split("<item>").slice(1)) {
      const url = tag(block, "link");
      if (!url.endsWith("/") || new URL(url).pathname === "/") {
        continue;
      }
      items.push({
        excerpt: tag(block, "description"),
        language,
        site,
        title: tag(block, "title"),
        url,
      });
    }
  });

  for (const it of items) {
    const base = { postId: it.url, site: it.site, slug: slugOf(it.url), status: "PUBLISHED" };
    for (const [field, value, kind] of [
      ["title", it.title, "title"],
      ["excerpt", it.excerpt, "text"],
    ] as const) {
      const r = stripEmDash(value, it.language, kind);
      if (r.changed) {
        changes.push({ ...base, after: r.text, before: value, counts: r.counts, field });
      }
    }
  }

  return { changes, scanned: items.length };
};
