import { describe, expect, it } from "vitest";

import { postPath, postPublicUrl, slugify, toCategorySlugMap } from "./post-url";

/** Both columns are non-null with DB defaults, so tests mirror real rows. */
const site = (
  over: { categorySlugMap?: unknown; defaultCategory?: string; domain?: string } = {},
) => ({
  categorySlugMap: {},
  defaultCategory: "sem-categoria",
  domain: "example.com",
  ...over,
});

describe("slugify", () => {
  it("lowercases and hyphenates words", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips diacritics", () => {
    expect(slugify("São Paulo")).toBe("sao-paulo");
  });

  it("drops punctuation", () => {
    expect(slugify("It's a Test!")).toBe("its-a-test");
  });

  it("collapses repeated separators", () => {
    expect(slugify("foo  --  bar")).toBe("foo-bar");
  });
});

describe("postPath", () => {
  it("buckets under the slugified first category", () => {
    expect(postPath(site(), { categories: ["Arquitetura"], slug: "casa-minimal" })).toBe(
      "/arquitetura/casa-minimal/",
    );
  });

  it("slugifies a multi-word category", () => {
    expect(postPath(site(), { categories: ["Arquitetura Moderna"], slug: "x" })).toBe(
      "/arquitetura-moderna/x/",
    );
  });

  it("falls back to sem-categoria with no categories", () => {
    expect(postPath(site(), { categories: [], slug: "orphan" })).toBe("/sem-categoria/orphan/");
  });

  it("uses only the first category", () => {
    expect(postPath(site(), { categories: ["Moda", "Tendências"], slug: "x" })).toBe("/moda/x/");
  });

  it("prefers a remap over slugify when the category is mapped", () => {
    expect(
      postPath(site({ categorySlugMap: { "Edição de Vídeo": "video" } }), {
        categories: ["Edição de Vídeo"],
        slug: "x",
      }),
    ).toBe("/video/x/");
  });

  it("falls back to slugify for an unmapped category", () => {
    expect(
      postPath(site({ categorySlugMap: { Arquitetura: "arq" } }), {
        categories: ["Moda"],
        slug: "x",
      }),
    ).toBe("/moda/x/");
  });

  it("honors a custom default category for category-less posts", () => {
    expect(postPath(site({ defaultCategory: "geral" }), { categories: [], slug: "orphan" })).toBe(
      "/geral/orphan/",
    );
  });
});

describe("toCategorySlugMap", () => {
  it("keeps string→string entries", () => {
    expect(toCategorySlugMap({ "Edição de Vídeo": "video", Moda: "moda" })).toEqual({
      "Edição de Vídeo": "video",
      Moda: "moda",
    });
  });

  it("drops non-string values", () => {
    expect(toCategorySlugMap({ a: "x", b: 3, c: null })).toEqual({ a: "x" });
  });

  it("returns an empty map for non-objects", () => {
    expect(toCategorySlugMap(null)).toEqual({});
    expect(toCategorySlugMap("nope")).toEqual({});
    expect(toCategorySlugMap(["a"])).toEqual({});
  });
});

describe("postPublicUrl", () => {
  it("builds the absolute URL from domain + category + slug", () => {
    expect(
      postPublicUrl(site({ domain: "fashion-blog.example" }), {
        categories: ["Moda"],
        slug: "editorial-de-moda",
      }),
    ).toBe("https://fashion-blog.example/moda/editorial-de-moda/");
  });
});
