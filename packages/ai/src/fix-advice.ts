import { z } from "zod";

import { generateStructured } from "./generate";

const severitySchema = z.enum(["low", "medium", "high"]);
const categorySchema = z.enum(["hosting", "wordpress", "content", "structure"]);

const fixStepSchema = z.object({
  description: z.string().min(10).max(400),
  manual: z.boolean(),
  snippet: z.string().min(1).max(2000).nullable(),
});

const fixAdviceSchema = z.object({
  autoApplyable: z.boolean(),
  category: categorySchema,
  problem: z.string().min(20).max(400),
  severity: severitySchema,
  steps: z.array(fixStepSchema).min(1).max(8),
});

export type FixAdviceSeverity = z.infer<typeof severitySchema>;
export type FixAdviceCategory = z.infer<typeof categorySchema>;
export type FixStep = z.infer<typeof fixStepSchema>;
export type FixAdvice = z.infer<typeof fixAdviceSchema>;

export type FixAdviceInput = {
  checkName: string;
  site: {
    domain: string;
    niches: ReadonlyArray<string>;
  };
};

const buildPrompt = (input: FixAdviceInput): string => {
  const niches = input.site.niches.length === 0 ? "unspecified" : input.site.niches.join(", ");
  return [
    "You are an SEO + web operations engineer. A DataForSEO on-page",
    "audit flagged a failing check on a site. Produce a concise, opinionated",
    "fix recipe an operator can execute today.",
    "",
    "Site context:",
    `- URL: https://${input.site.domain}`,
    `- Domain: ${input.site.domain}`,
    "- Stack: Astro static site on Vercel",
    `- Niches: ${niches}`,
    "",
    `Failing check: ${input.checkName}`,
    "",
    "Return a JSON object with these fields:",
    "- problem: 1-2 sentence plain-English explanation of what this check means",
    "  and why it matters. No marketing fluff. No 'discover', 'unlock'.",
    "- severity: 'low' | 'medium' | 'high'. Use 'high' only when the issue",
    "  meaningfully blocks indexing, rendering, or crawl. Cosmetic issues",
    "  are 'low'.",
    "- category: 'hosting' (CDN/Vercel config), 'wordpress' (legacy WP",
    "  concern), 'content' (copy/alt text/meta), or 'structure' (URLs/",
    "  redirects/canonical/sitemap).",
    "- steps: 1-8 ordered fix steps. Each step has:",
    "  - description: imperative, specific, no fluff.",
    "  - snippet: copy-pasteable command, config block, or selector when",
    "    it genuinely saves time. Set to null when no snippet is useful.",
    "  - manual: true if the operator must do it by hand (SSH, .htaccess,",
    "    plugin install, DNS); false when achievable via the WordPress",
    "    REST API alone (post meta, alt text, options endpoint).",
    "- autoApplyable: true only if every step has manual=false AND the",
    "  full fix can be reached through the WP REST API without SSH, .htaccess,",
    "  DNS, or new plugin installation. Otherwise false.",
    "",
    "Match the user-facing language to the site's likely audience.",
  ].join("\n");
};

export const generateFixAdvice = (input: FixAdviceInput): Promise<FixAdvice> => {
  return generateStructured({ prompt: buildPrompt(input), schema: fixAdviceSchema });
};

export { buildPrompt as buildFixAdvicePrompt, fixAdviceSchema };
