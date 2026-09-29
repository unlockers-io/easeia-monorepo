import { describe, expect, it } from "vitest";

import { buildRewritePrompt } from "../prompt";
import { SITE_LANGUAGE_HUMAN } from "../prompt-constants";

import { EVAL_CASES, EVAL_LANGUAGE_TO_SITE, type EvalLanguage } from "./cases";

const LANGUAGE_LABEL: Record<EvalLanguage, string> = {
  en: "English",
  es: "Spanish",
  pt: "Portuguese",
};

describe("rewrite prompt evals", () => {
  for (const evalCase of EVAL_CASES) {
    it(`[${LANGUAGE_LABEL[evalCase.language]}] ${evalCase.sweep}: ${evalCase.id}`, () => {
      const prompt = buildRewritePrompt({
        anchors: [
          {
            anchor: "Acme Studios",
            reason: "money site reference",
            url: "https://acmestudios.example/spaces/example",
          },
        ],
        moneySiteName: "Acme Studios",
        post: {
          body: evalCase.body,
          excerpt: evalCase.excerpt,
          focusKeyword: evalCase.focusKeyword,
          niches: ["WEDDING"],
          tags: ["network"],
          title: evalCase.title,
        },
        siteDomain: "evals.localhost",
        siteLanguage: EVAL_LANGUAGE_TO_SITE[evalCase.language],
        siteNiches: ["WEDDING"],
      });

      expect(prompt).toContain("WRITING VOICE RULES");
      expect(prompt).toContain("ANTI-AI PATTERNS");
      expect(prompt).toContain("SEO METHODOLOGY");
      expect(prompt).toContain("COPYWRITING FRAMEWORK");
      expect(prompt).toContain("COPY EDITING: SEVEN SWEEPS");
      expect(prompt).toContain("CONTENT REFRESH CHECKLIST");
      expect(prompt).toContain("PLAIN-ENGLISH SWAPS");

      expect(prompt).toContain(evalCase.title);
      expect(prompt).toContain(evalCase.body);

      expect(prompt).toContain(SITE_LANGUAGE_HUMAN[EVAL_LANGUAGE_TO_SITE[evalCase.language]]);
    });
  }
});
