import { prisma } from "@repo/db";
import { stripEmDash } from "@repo/posts";

import type { Change, Coverage } from "./report";

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

/** Balanced-div scan so a nested div inside the article does not truncate it. */
const proseOf = (html: string): string | null => {
  const i = html.indexOf('class="prose"');
  if (i === -1) {
    return null;
  }
  const start = html.indexOf(">", i) + 1;
  let depth = 1;
  let j = start;
  while (depth > 0) {
    const open = html.indexOf("<div", j);
    const close = html.indexOf("</div", j);
    if (close === -1) {
      return html.slice(start);
    }
    if (open !== -1 && open < close) {
      depth += 1;
      j = open + 4;
    } else {
      depth -= 1;
      j = close + 5;
    }
  }
  return html.slice(start, j - 5);
};

const proseText = (prose: string): string =>
  decodeEntities(
    prose
      .replaceAll(/<\/(?<block>p|li|h[1-6]|blockquote|td|th)>/g, "\n")
      .replaceAll(/<[^>]+>/g, " "),
  )
    .replaceAll(/[ \t]+/g, " ")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trim();

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

export const collectPreviewChanges = async (
  bodyLimitPerSite: number,
): Promise<{ changes: Array<Change>; coverage: Coverage }> => {
  const changes: Array<Change> = [];
  const items: Array<{ excerpt: string; site: string; title: string; url: string }> = [];

  const sites = await prisma.site.findMany({
    orderBy: { domain: "asc" },
    select: { domain: true },
    where: { isEnabled: true },
  });
  await mapLimit(sites, async ({ domain: site }) => {
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
      items.push({ excerpt: tag(block, "description"), site, title: tag(block, "title"), url });
    }
  });

  const push = (
    base: Omit<Change, "after" | "before" | "counts" | "field">,
    field: Change["field"],
    value: string,
    kind: "markdown" | "text" | "title",
  ): void => {
    const r = stripEmDash(value, kind);
    if (r.changed) {
      changes.push({ ...base, after: r.text, before: value, counts: r.counts, field });
    }
  };

  for (const it of items) {
    const base = { postId: it.url, site: it.site, slug: slugOf(it.url), status: "PUBLISHED" };
    push(base, "title", it.title, "title");
    push(base, "excerpt", it.excerpt, "text");
  }

  const perSite = new Map<string, number>();
  const bodyTargets = items.filter((it) => {
    const n = perSite.get(it.site) ?? 0;
    if (n >= bodyLimitPerSite) {
      return false;
    }
    perSite.set(it.site, n + 1);
    return true;
  });

  console.error(
    `preview: ${items.length} posts from RSS (census for title + excerpt), fetching ${bodyTargets.length} bodies (sample)`,
  );
  let bodiesRead = 0;
  await mapLimit(bodyTargets, async (it) => {
    const html = await get(it.url);
    if (html === null) {
      return;
    }
    const prose = proseOf(html);
    if (prose === null) {
      return;
    }
    bodiesRead += 1;
    push(
      { postId: it.url, site: it.site, slug: slugOf(it.url), status: "PUBLISHED" },
      "body",
      proseText(prose),
      "markdown",
    );
  });

  return { changes, coverage: { bodiesRead, scanned: items.length } };
};
