import type { SiteLanguage } from "@repo/db";
import { describe, expect, it } from "vitest";

import { buildRewritePrompt } from "./prompt";

const promptFor = (siteLanguage: SiteLanguage): string =>
  buildRewritePrompt({
    anchors: [],
    moneySiteName: null,
    post: {
      body: "<p>Natural light makes a room feel larger.</p>",
      excerpt: null,
      focusKeyword: null,
      niches: ["WEDDING"],
      tags: [],
      title: "Natural light at home",
    },
    siteDomain: "pbn1.com",
    siteLanguage,
    siteNiches: ["WEDDING"],
  });

describe("buildRewritePrompt", () => {
  it("includes the voice rules + each anchor + the post body", () => {
    const out = buildRewritePrompt({
      anchors: [
        {
          anchor: "Casa A",
          reason: "money site",
          url: "https://acmestudios.example/spaces/casa-a",
        },
        { anchor: "Internal post", reason: "internal", url: "https://pbn1.com/internal-post" },
      ],
      moneySiteName: "Acme Studios",
      post: {
        body: "<p>Original body content here.</p>",
        excerpt: "Original excerpt",
        focusKeyword: "wedding",
        niches: ["WEDDING"],
        tags: ["destination wedding"],
        title: "Original title",
      },
      siteDomain: "pbn1.com",
      siteLanguage: "PT",
      siteNiches: ["WEDDING"],
    });
    expect(out).toContain("WRITING VOICE RULES");
    expect(out).toContain("ANTI-AI PATTERNS");
    expect(out).toContain("COPY EDITING: SEVEN SWEEPS");
    expect(out).toContain("CONTENT REFRESH CHECKLIST");
    expect(out).toContain("PLAIN-ENGLISH SWAPS");
    expect(out).toContain("https://acmestudios.example/spaces/casa-a");
    expect(out).toContain("Original body content here");
    expect(out).toContain("Acme Studios");
  });

  it("targets the site's language, not the language the post is already in", () => {
    const out = promptFor("PT");
    expect(out).toContain("Portuguese (Brazil)");
    expect(out).toContain("translate it");
    expect(out).not.toContain("Keep the rewrite in the same language");
    expect(out).not.toContain("matching the post's original language");
  });

  it("names each supported site language", () => {
    expect(promptFor("EN")).toContain("English");
    expect(promptFor("ES")).toContain("Spanish (Spain)");
  });
});
