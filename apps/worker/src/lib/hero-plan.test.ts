import { describe, expect, it } from "vitest";

import { planHero, type PlanHeroInput } from "./hero-plan";

const R2 = "https://img.easeia.com";
const r2Url = (name: string) => `${R2}/sites/s1/posts/p1/${name}`;

const plan = (over: Partial<PlanHeroInput> = {}) =>
  planHero({
    autogenEnabled: true,
    featuredImage: null,
    hero: null,
    r2PublicBaseUrl: R2,
    ...over,
  });

describe("planHero", () => {
  it("generates when there is no hero row and no import source", () => {
    expect(plan()).toEqual({ kind: "generate" });
  });

  it("skips when there is nothing to do and autogen is off", () => {
    expect(plan({ autogenEnabled: false })).toEqual({ kind: "skip" });
  });

  it("generates when featuredImage points at R2 but no hero row backs it", () => {
    // The combination that previously published heroless in silence.
    expect(plan({ featuredImage: r2Url("abc.jpg") })).toEqual({ kind: "generate" });
  });

  it("skips that same combination when autogen is off, rather than silently continuing", () => {
    expect(plan({ autogenEnabled: false, featuredImage: r2Url("abc.jpg") })).toEqual({
      kind: "skip",
    });
  });

  it("imports a foreign featuredImage when there is no hero row", () => {
    expect(plan({ featuredImage: "https://cdn.example/hero.jpg" })).toEqual({
      filename: "hero.jpg",
      kind: "import",
      sourceUrl: "https://cdn.example/hero.jpg",
    });
  });

  it("is ready when the hero row already holds that exact file on R2", () => {
    expect(
      plan({
        featuredImage: "https://cdn.example/hero.jpg",
        hero: { blobUrl: r2Url("hero.jpg"), filename: "hero.jpg" },
      }),
    ).toEqual({ kind: "ready" });
  });

  it("re-imports when the source image changed (filename mismatch)", () => {
    expect(
      plan({
        featuredImage: "https://cdn.example/new.jpg",
        hero: { blobUrl: r2Url("old.jpg"), filename: "old.jpg" },
      }),
    ).toEqual({
      filename: "new.jpg",
      kind: "import",
      sourceUrl: "https://cdn.example/new.jpg",
    });
  });

  it("is ready when an R2 hero row exists and there is no import source", () => {
    expect(plan({ hero: { blobUrl: r2Url("h.jpg"), filename: "h.jpg" } })).toEqual({
      kind: "ready",
    });
  });

  it("re-imports a hero row that is not R2-hosted, from its own URL", () => {
    expect(plan({ hero: { blobUrl: "https://old-cdn.example/x.jpg", filename: "x.jpg" } })).toEqual(
      {
        filename: "x.jpg",
        kind: "import",
        sourceUrl: "https://old-cdn.example/x.jpg",
      },
    );
  });

  it("treats an unset R2 base as nothing being R2-hosted", () => {
    expect(
      plan({
        featuredImage: "https://cdn.example/hero.jpg",
        hero: { blobUrl: "https://cdn.example/hero.jpg", filename: "hero.jpg" },
        r2PublicBaseUrl: undefined,
      }),
    ).toEqual({
      filename: "hero.jpg",
      kind: "import",
      sourceUrl: "https://cdn.example/hero.jpg",
    });
  });

  it("treats an empty featuredImage as absent", () => {
    expect(plan({ featuredImage: "" })).toEqual({ kind: "generate" });
  });
});
