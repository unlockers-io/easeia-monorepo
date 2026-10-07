import { prisma } from "@repo/db";
import {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
} from "@repo/health";
import { approveSuggestions, listSuggestions } from "@repo/links";
import { findRelevantPages } from "@repo/money-sites";
import { z } from "zod";

import { generateWithAnchors } from "./anchored-generation";
import { assertRewriteIsSane } from "./guard";
import { buildRewritePrompt, type AnchorSpec } from "./prompt";
import { pickTopByRecencyAndType } from "./select";

const SUGGESTION_OVERFETCH = 10;
const TOP_INTERNAL_PBN = 3;
const TOP_MONEY_SITE = 2;

const rewriteOutputSchema = z.object({
  body: z.string().min(50),
  excerpt: z.string().min(SEO_DESCRIPTION_MIN).max(SEO_DESCRIPTION_MAX),
  focusKeyword: z.string().min(2).max(80),
  title: z.string().min(SEO_TITLE_MIN).max(SEO_TITLE_MAX),
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

  const candidateLinks = await listSuggestions({
    fromPostId: postId,
    limit: SUGGESTION_OVERFETCH,
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

  const { missing, output, retryUsed } = await generateWithAnchors({
    anchors,
    insertInstruction: "Insert each one inline at a natural spot in the body.",
    prompt: buildRewritePrompt({
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
    }),
    schema: rewriteOutputSchema,
  });
  const { excerpt, focusKeyword, title } = output;
  const fallbackHtml = missing.map((a) => `<a href="${a.url}">${a.anchor}</a>`).join(" · ");
  const body =
    missing.length === 0
      ? output.body
      : `${output.body}\n\n<p><strong>Veja também:</strong> ${fallbackHtml}</p>`;

  assertRewriteIsSane({ after: body, before: post.body, postId });

  await prisma.post.update({
    data: { body, excerpt, focusKeyword, rewrittenAt: new Date(), title },
    where: { id: postId },
  });
  await approveSuggestions(
    postId,
    topInternalPbn.map((l) => l.id),
  );

  return {
    anchorsForcedByFallback: missing.length,
    anchorsRequested: anchors.length,
    outcome: "rewritten",
    retryUsed,
  };
};
