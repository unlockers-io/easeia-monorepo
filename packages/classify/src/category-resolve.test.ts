import { Niche } from "@repo/db";
import { describe, expect, it } from "vitest";

import { pickExistingCategory } from "./category-resolve";

describe("pickExistingCategory", () => {
  it("returns null when no site post is categorized", () => {
    expect(pickExistingCategory([], [Niche.FILM])).toBeNull();
    expect(
      pickExistingCategory([{ categories: [], niches: [Niche.FILM] }], [Niche.FILM]),
    ).toBeNull();
  });

  it("prefers the most common category among niche-overlapping posts", () => {
    const posts = [
      { categories: ["Locações"], niches: [Niche.FILM] },
      { categories: ["Locações"], niches: [Niche.VIDEOGRAPHY] },
      { categories: ["Áudio"], niches: [Niche.AUDIO] },
      { categories: ["Áudio"], niches: [Niche.AUDIO] },
      { categories: ["Áudio"], niches: [Niche.AUDIO] },
    ];
    expect(pickExistingCategory(posts, [Niche.FILM])).toBe("Locações");
  });

  it("falls back to the site's most common category when no niche overlaps", () => {
    const posts = [
      { categories: ["Áudio"], niches: [Niche.AUDIO] },
      { categories: ["Áudio"], niches: [Niche.AUDIO] },
      { categories: ["Música"], niches: [Niche.AUDIO] },
    ];
    expect(pickExistingCategory(posts, [Niche.FASHION])).toBe("Áudio");
  });
});
