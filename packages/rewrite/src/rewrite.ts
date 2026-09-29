import { requireProvider } from "@repo/ai";
import { LinkSource, prisma } from "@repo/db";
import { findRelevantPages } from "@repo/money-sites";
import { generateText, Output } from "ai";
import { z } from "zod";

import { assertRewriteIsSane } from "./guard";
import { buildRewritePrompt, type AnchorSpec } from "./prompt";
import { REWRITER_MODEL } from "./prompt-constants";
import { pickTopByRecencyAndType } from "./select";

const SUGGESTION_OVERFETCH = 10;
const TOP_INTERNAL_PBN = 3;
const TOP_MONEY_SITE = 2;

const rewriteOutputSchema = z.object({
  body: z.string().min(50),
  excerpt: z.string().min(70).max(160),
  focusKeyword: z.string().min(2).max(80),
  title: z.string().min(30).max(60),
});

export type RewriteOptions = {
  force?: boolean;
};

export type RewriteResult =
  | { outcome: "skipped"; reason: "already_rewritten" | "not_found" }
  | {
      anchorsForcedByFallback: number;
      anchorsRequested: number;
      outcome: "rewritten";
      retryUsed: boolean;
    };

export const findMissingAnchors = (
  body: string,
  anchors: ReadonlyArray<AnchorSpec>,
): Array<AnchorSpec> => anchors.filter((a) => !body.includes(a.url));

export const rewritePost = async (
  postId: string,
  opts: RewriteOptions = {},
): Promise<RewriteResult> => {
  const post = await prisma.post.findUnique({
    include: { site: { include: { moneySite: true } } },
    where: { id: postId },
  });
  if (!post) {
    return { outcome: "skipped", reason: "not_found" };
  }
  if (post.rewrittenAt !== null && opts.force !== true) {
    return { outcome: "skipped", reason: "already_rewritten" };
  }

  const candidateLinks = await prisma.link.findMany({
    include: { toPost: { select: { id: true, slug: true, title: true } } },
    orderBy: { suggestedAt: "desc" },
    take: SUGGESTION_OVERFETCH,
    where: {
      approved: null,
      fromPostId: postId,
      source: LinkSource.SUGGESTED,
      toPostId: { not: null },
    },
  });
  const topInternalPbn = pickTopByRecencyAndType(candidateLinks, TOP_INTERNAL_PBN);
  const moneyPages =
    post.site.moneySiteId !== null && post.site.moneySiteId !== ""
      ? await findRelevantPages(postId, TOP_MONEY_SITE)
      : [];

  const anchors: Array<AnchorSpec> = [
    ...topInternalPbn.map((l) => ({
      anchor: l.anchorText,
      reason: `Internal/PBN link to "${l.toPost?.title ?? "related post"}"`,
      url: l.toUrl,
    })),
    ...moneyPages.map((p) => ({
      anchor: p.title,
      reason: `${post.site.moneySite?.name ?? "Money site"} page about: ${p.title}`,
      url: p.url,
    })),
  ];

  const provider = requireProvider();
  const prompt = buildRewritePrompt({
    anchors,
    moneySiteName: post.site.moneySite?.name ?? null,
    post: {
      body: post.body,
      excerpt: post.excerpt,
      focusKeyword: post.focusKeyword,
      niches: post.niches,
      tags: post.tags,
      title: post.title,
    },
    siteDomain: post.site.domain,
    siteLanguage: post.site.language,
    siteNiches: post.site.niches,
  });
  const first = await generateText({
    model: provider(REWRITER_MODEL),
    output: Output.object({ schema: rewriteOutputSchema }),
    prompt,
  });
  let { body, excerpt, focusKeyword, title } = first.output;

  let retryUsed = false;
  let anchorsForcedByFallback = 0;
  let missing = findMissingAnchors(body, anchors);
  if (missing.length > 0) {
    retryUsed = true;
    const retryPrompt = `${prompt}\n\nIMPORTANT: your previous output was missing these links: ${missing
      .map((a) => a.url)
      .join(", ")}. Insert each one inline at a natural spot in the body.`;
    const retry = await generateText({
      model: provider(REWRITER_MODEL),
      output: Output.object({ schema: rewriteOutputSchema }),
      prompt: retryPrompt,
    });
    title = retry.output.title;
    body = retry.output.body;
    excerpt = retry.output.excerpt;
    focusKeyword = retry.output.focusKeyword;
    missing = findMissingAnchors(body, anchors);
    if (missing.length > 0) {
      anchorsForcedByFallback = missing.length;
      const fallbackHtml = missing.map((a) => `<a href="${a.url}">${a.anchor}</a>`).join(" · ");
      body += `\n\n<p><strong>Veja também:</strong> ${fallbackHtml}</p>`;
    }
  }

  assertRewriteIsSane({ after: body, before: post.body, postId });

  await prisma.$transaction([
    prisma.post.update({
      data: { body, excerpt, focusKeyword, rewrittenAt: new Date(), title },
      where: { id: postId },
    }),
    prisma.link.updateMany({
      data: { approved: true },
      where: { id: { in: topInternalPbn.map((l) => l.id) } },
    }),
  ]);

  return {
    anchorsForcedByFallback,
    anchorsRequested: anchors.length,
    outcome: "rewritten",
    retryUsed,
  };
};
