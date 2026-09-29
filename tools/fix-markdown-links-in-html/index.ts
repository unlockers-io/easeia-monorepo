/**
 * Dry-run by default. --apply rewrites markdown links to anchors in the 70 posts
 * whose body is WordPress block HTML. Markdown is not parsed inside a raw HTML
 * block, so those links render to readers as literal [text](url).
 */
import "dotenv/config";

import { prisma } from "@repo/db";

import { recordAffectedSites } from "../_shared/affected-sites";

const APPLY = process.argv.includes("--apply");

const MARKDOWN_LINK = /\[(?<text>[^\]\n]+)\]\((?<url>https?:\/\/[^)\s]+)\)/gu;

const escapeAttribute = (url: string): string =>
  url.replaceAll("&", "&amp;").replaceAll('"', "&quot;");

const main = async (): Promise<void> => {
  const posts = await prisma.post.findMany({
    select: { body: true, id: true, siteId: true, slug: true },
  });

  const planned: Array<{ body: string; id: string; links: number; siteId: string; slug: string }> =
    [];
  for (const post of posts) {
    const { body } = post;
    if (!body.includes("<!-- wp:")) {
      continue;
    }
    const links = [...body.matchAll(MARKDOWN_LINK)].length;
    if (links === 0) {
      continue;
    }
    const next = body.replaceAll(MARKDOWN_LINK, (...args) => {
      const { text, url } = args.at(-1) as { text: string; url: string };
      return `<a href="${escapeAttribute(url)}">${text}</a>`;
    });
    planned.push({ body: next, id: post.id, links, siteId: post.siteId, slug: post.slug });
  }

  const total = planned.reduce((sum, post) => sum + post.links, 0);
  console.log(`posts to update: ${planned.length}`);
  console.log(`markdown links converted: ${total}`);

  if (!APPLY) {
    for (const post of planned.slice(0, 5)) {
      const first = MARKDOWN_LINK.exec(posts.find((p) => p.id === post.id)?.body ?? "");
      MARKDOWN_LINK.lastIndex = 0;
      console.log(`  ${post.slug} (${post.links})`);
      if (first) {
        console.log(`    - ${first[0].slice(0, 96)}`);
        console.log(
          `    + <a href="${escapeAttribute(first.groups?.url ?? "").slice(0, 70)}">${(first.groups?.text ?? "").slice(0, 40)}</a>`,
        );
      }
    }
    console.log("\ndry run; pass --apply to write");
    return;
  }

  for (const post of planned) {
    await prisma.post.update({ data: { body: post.body }, where: { id: post.id } });
  }
  const touched = recordAffectedSites([...new Set(planned.map((post) => post.siteId))]);
  console.log(`\nupdated ${planned.length} posts; ${touched.length} sites pending redeploy`);
};

await main();
await prisma.$disconnect();
