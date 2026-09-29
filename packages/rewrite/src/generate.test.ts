import { describe, expect, it } from "vitest";

import { buildGeneratePrompt, LanguageMismatchError } from "./generate";

describe("buildGeneratePrompt", () => {
  it("emits an explicit language instruction matching site.language (PT)", () => {
    const prompt = buildGeneratePrompt({
      anchors: [],
      serpContext: null,
      site: {
        domain: "film-blog.example",
        language: "PT",
        moneySiteName: null,
        niches: ["FILM", "VIDEOGRAPHY"],
      },
      topicHints: null,
    });
    expect(prompt).toContain("Portuguese (Brazil)");
    expect(prompt).toContain("Do not translate to English");
    expect(prompt).toContain("film-blog.example");
  });

  it("emits English instruction when site.language is EN", () => {
    const prompt = buildGeneratePrompt({
      anchors: [],
      serpContext: null,
      site: {
        domain: "example.com",
        language: "EN",
        moneySiteName: null,
        niches: ["TECH"],
      },
      topicHints: null,
    });
    expect(prompt).toContain("English");
    expect(prompt).toContain("Do not translate to English");
  });

  it("embeds anchors with their URLs when provided", () => {
    const prompt = buildGeneratePrompt({
      anchors: [
        {
          anchor: "Casa A",
          reason: "Acme Studios page: Casa A",
          url: "https://acmestudios.example/spaces/casa-a",
        },
        {
          anchor: "Why we love film",
          reason: "Internal/PBN link to peer post",
          url: "https://film-blog.example/why-we-love-film",
        },
      ],
      serpContext: null,
      site: {
        domain: "film-blog.example",
        language: "PT",
        moneySiteName: "Acme Studios",
        niches: ["FILM"],
      },
      topicHints: null,
    });
    expect(prompt).toContain("LINKS TO INSERT");
    expect(prompt).toContain("https://acmestudios.example/spaces/casa-a");
    expect(prompt).toContain("https://film-blog.example/why-we-love-film");
    expect(prompt).toContain('anchor text: "Casa A"');
  });

  it("embeds the focus keyword and ranking competitors when serpContext is provided", () => {
    const prompt = buildGeneratePrompt({
      anchors: [],
      serpContext: {
        competitors: [
          { description: "A generic checklist.", title: "10 dicas de casamento na praia" },
          { description: null, title: "Guia de casamento na praia" },
        ],
        focusKeyword: "casamento na praia custo",
      },
      site: {
        domain: "example.com",
        language: "PT",
        moneySiteName: null,
        niches: ["WEDDING"],
      },
      topicHints: null,
    });
    expect(prompt).toContain('TARGET FOCUS KEYWORD: "casamento na praia custo"');
    expect(prompt).toContain("ALREADY RANKING");
    expect(prompt).toContain("10 dicas de casamento na praia: A generic checklist.");
    expect(prompt).toContain("2. Guia de casamento na praia");
    expect(prompt).toContain("DIFFERENTIATION REQUIREMENTS");
  });

  it("omits the SERP section when serpContext is null", () => {
    const prompt = buildGeneratePrompt({
      anchors: [],
      serpContext: null,
      site: {
        domain: "example.com",
        language: "PT",
        moneySiteName: null,
        niches: ["TECH"],
      },
      topicHints: null,
    });
    expect(prompt).not.toContain("TARGET FOCUS KEYWORD");
    expect(prompt).not.toContain("ALREADY RANKING");
  });

  it("omits the anchors section entirely when no anchors are passed", () => {
    const prompt = buildGeneratePrompt({
      anchors: [],
      serpContext: null,
      site: {
        domain: "example.com",
        language: "PT",
        moneySiteName: null,
        niches: ["TECH"],
      },
      topicHints: null,
    });
    expect(prompt).not.toContain("LINKS TO INSERT");
  });
});

describe("LanguageMismatchError", () => {
  it("carries expected/detected/francCode for inspection in logs", () => {
    const err = new LanguageMismatchError("PT", "EN", "eng");
    expect(err.name).toBe("LanguageMismatchError");
    expect(err.expected).toBe("PT");
    expect(err.detected).toBe("EN");
    expect(err.francCode).toBe("eng");
    expect(err.message).toContain("PT");
    expect(err.message).toContain("EN");
  });
});
