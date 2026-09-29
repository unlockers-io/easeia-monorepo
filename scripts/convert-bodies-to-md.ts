import { prisma } from "@repo/db";
import TurndownService from "turndown";

const stripGutenbergFences = (html: string): string =>
  html.replaceAll(/<!--\s*\/?wp:[^>]*?-->/g, "");

const HTML_TAG = /<[a-zA-Z]/;

const buildTurndown = (): TurndownService => {
  const td = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    fence: "```",
    headingStyle: "atx",
    hr: "---",
    linkStyle: "inlined",
    strongDelimiter: "**",
  });

  td.addRule("figure", {
    filter: "figure",
    replacement: (_content, node) => {
      const el = node as unknown as {
        querySelector: (sel: string) => null | {
          getAttribute: (name: string) => string | null;
          textContent?: string;
        };
      };
      const img = el.querySelector("img");
      const captionEl = el.querySelector("figcaption");
      const src = img?.getAttribute("src") ?? "";
      const alt = img?.getAttribute("alt") ?? "";
      const caption = captionEl?.textContent?.trim() ?? "";
      const imgMd = `![${alt}](${src})`;
      return caption ? `${imgMd}\n\n*${caption}*` : imgMd;
    },
  });

  return td;
};

const run = async (): Promise<void> => {
  const td = buildTurndown();
  const posts = await prisma.post.findMany({
    select: { body: true, id: true, slug: true },
    where: { status: "PUBLISHED" },
  });

  console.log(`[convert] ${posts.length} PUBLISHED posts to inspect`);

  let converted = 0;
  let skipped = 0;
  let failed = 0;

  for (const p of posts) {
    if (!HTML_TAG.test(p.body)) {
      skipped += 1;
      continue;
    }
    try {
      const md = td.turndown(stripGutenbergFences(p.body)).trim();
      await prisma.post.update({ data: { body: md }, where: { id: p.id } });
      converted += 1;
      console.log(`  ✓ ${p.slug}`);
    } catch (error) {
      failed += 1;
      console.error(`  ✗ ${p.slug}:`, error);
    }
  }

  console.log(`[convert] done — converted=${converted} skipped=${skipped} failed=${failed}`);
  await prisma.$disconnect();
};

await run();
