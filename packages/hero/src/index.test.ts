import { AiBudgetExceededError } from "@repo/ai";
import { createFakeOpenAi } from "@repo/ai/testing";
import { describe, expect, it } from "vitest";

import { buildBodyImagePrompt, buildHeroPrompt, generateHero } from "./index";

const audioStyle = "Professional audio studio scene, recording and mixing gear.";
const fashionStyle = "Street fashion editorial, contemporary urban styling.";

describe("buildHeroPrompt", () => {
  it("uses the site-specific style and includes the post title", () => {
    const prompt = buildHeroPrompt(audioStyle, {
      slug: "guia-de-microfones",
      tags: ["microfone", "estudio"],
      title: "Guia de Microfones",
    });
    expect(prompt).toContain("Professional audio studio scene");
    expect(prompt).toContain('"Guia de Microfones"');
    expect(prompt).toContain("Themes: microfone, estudio");
    expect(prompt).toContain("16:9 landscape framing");
  });

  it("falls back to a generic editorial style when no style is configured", () => {
    const prompt = buildHeroPrompt(null, { slug: "x", tags: [], title: "X" });
    expect(prompt).toContain("Editorial blog hero photograph");
    expect(prompt).not.toContain("Themes:");
  });

  it.each(["", "   "])("uses the default when a saved style is blank", (style) => {
    expect(buildHeroPrompt(style, { slug: "x", tags: [], title: "X" })).toContain(
      "Editorial blog hero photograph",
    );
  });

  it("is deterministic: the same slug always yields the same prompt", () => {
    const post = { slug: "guia-de-microfones", tags: ["microfone"], title: "Guia de Microfones" };
    expect(buildHeroPrompt(audioStyle, post)).toBe(buildHeroPrompt(audioStyle, post));
  });

  it("varies shot, lens, light and palette across slugs on one site", () => {
    const looks = new Set(
      ["guia-de-microfones", "tratamento-acustico", "gravacao-de-voz", "mixagem-em-casa"].map(
        (slug) => {
          const prompt = buildHeroPrompt(audioStyle, { slug, tags: [], title: "T" });
          return prompt.slice(prompt.indexOf("Shot as: "), prompt.indexOf("16:9"));
        },
      ),
    );
    expect(looks.size).toBe(4);
  });

  it("keeps the site style fixed while the look changes", () => {
    const a = buildHeroPrompt(fashionStyle, { slug: "a", tags: [], title: "T" });
    const b = buildHeroPrompt(fashionStyle, { slug: "b", tags: [], title: "T" });
    expect(a).toContain("Street fashion editorial");
    expect(b).toContain("Street fashion editorial");
    expect(a).not.toBe(b);
  });
});

describe("buildBodyImagePrompt", () => {
  const base = { slug: "guia-de-microfones", style: audioStyle, subject: "" };

  it("keeps the site style and uses the planned subject, not the post title", () => {
    const prompt = buildBodyImagePrompt({
      ...base,
      index: 1,
      subject: "hands adjusting a mixing console fader",
    });
    expect(prompt).toContain("Professional audio studio scene");
    expect(prompt).toContain('"hands adjusting a mixing console fader"');
    expect(prompt).toContain("16:9 landscape framing");
  });

  it("varies the look across images within one post", () => {
    const looks = new Set(
      [1, 2, 3, 4].map((index) => {
        const prompt = buildBodyImagePrompt({ ...base, index, subject: "a studio" });
        return prompt.slice(prompt.indexOf("Shot as: "), prompt.indexOf("16:9"));
      }),
    );
    expect(looks.size).toBe(4);
  });

  it("falls back to a generic style when no style is configured", () => {
    const prompt = buildBodyImagePrompt({
      index: 1,
      slug: "x",
      style: null,
      subject: "a desk",
    });
    expect(prompt).toContain("Editorial blog photograph");
  });

  it("uses the default when a saved style is blank", () => {
    expect(buildBodyImagePrompt({ index: 1, slug: "x", style: "  ", subject: "a desk" })).toContain(
      "Editorial blog photograph",
    );
  });
});

describe("generateHero", () => {
  const post = {
    categories: ["audio"],
    id: "post_1",
    siteId: "site_1",
    slug: "guia-de-microfones",
    tags: ["microfone"],
    title: "Guia de Microfones",
  };
  const site = { imageStyle: audioStyle };

  it("generates, converts, uploads, and persists the hero", async () => {
    const fake = createFakeOpenAi();
    const calls: Record<string, unknown> = {};
    const result = await generateHero(
      { post, site },
      {
        blob: {
          upload: (input) => {
            calls.upload = input;
            return Promise.resolve({
              key: "sites/site_1/posts/post_1/abc.jpg",
              url: "https://img.easeia.com/sites/site_1/posts/post_1/abc.jpg",
            });
          },
        },
        generateImage: fake.ai.generateImage,
        writeHero: (input) => {
          calls.writeHero = input;
          return Promise.resolve();
        },
      },
    );

    const prompt = fake.requests[0]?.body.prompt;
    expect(prompt).toContain("Guia de Microfones");
    expect(prompt).toContain(audioStyle);
    const upload = calls.upload as { bytes: Uint8Array; filename: string; postId: string };
    expect(upload.filename).toBe("guia-de-microfones.jpg");
    expect(upload.postId).toBe("post_1");
    expect([...upload.bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    expect(calls.writeHero).toMatchObject({
      blobUrl: "https://img.easeia.com/sites/site_1/posts/post_1/abc.jpg",
      height: 1,
      isHero: true,
      postId: "post_1",
      width: 1,
    });
    expect(result.url).toContain("img.easeia.com");
  });

  it("propagates generation failures (caller decides what to do)", async () => {
    const fake = createFakeOpenAi({ allowanceMicroUsd: 0 });
    await expect(
      generateHero({ post, site }, { generateImage: fake.ai.generateImage }),
    ).rejects.toBeInstanceOf(AiBudgetExceededError);
  });
});
