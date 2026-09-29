import { Niche } from "@repo/db";
import { describe, expect, it } from "vitest";
import { ZodError } from "zod";

import { postCreateFromFormData } from "./posts";

const fd = (entries: Array<[string, string]>): FormData => {
  const form = new FormData();
  for (const [k, v] of entries) {
    form.append(k, v);
  }
  return form;
};

describe("postCreateFromFormData", () => {
  const required: Array<[string, string]> = [
    ["body", "# title\n\nbody"],
    ["siteId", "ckxxx"],
    ["slug", "my-post"],
    ["title", "Hello"],
  ];

  it("returns a fully-typed PostCreate from minimal FormData", () => {
    const out = postCreateFromFormData(fd(required));
    expect(out).toMatchObject({
      body: "# title\n\nbody",
      categories: [],
      niches: [],
      publish: false,
      siteId: "ckxxx",
      slug: "my-post",
      tags: [],
      title: "Hello",
    });
  });

  it("splits comma-separated categories and tags, trimming whitespace", () => {
    const out = postCreateFromFormData(
      fd([...required, ["categories", "  Wed, Photo "], ["tags", "weddings, portraits, "]]),
    );
    expect(out.categories).toEqual(["Wed", "Photo"]);
    expect(out.tags).toEqual(["weddings", "portraits"]);
  });

  it("collects repeated niches[] keys into an array", () => {
    const form = fd(required);
    form.append("niches", Niche.WEDDING);
    form.append("niches", Niche.PHOTOGRAPHY);
    expect(postCreateFromFormData(form).niches).toEqual([Niche.WEDDING, Niche.PHOTOGRAPHY]);
  });

  it("treats publish=on as boolean true; missing as false", () => {
    expect(postCreateFromFormData(fd([...required, ["publish", "on"]])).publish).toBe(true);
    expect(postCreateFromFormData(fd(required)).publish).toBe(false);
  });

  it("coerces scheduledAt to a Date when present, omits when blank", () => {
    const ts = "2026-12-31T10:00";
    const withDate = postCreateFromFormData(fd([...required, ["scheduledAt", ts]]));
    expect(withDate.scheduledAt).toBeInstanceOf(Date);
    const blank = postCreateFromFormData(fd([...required, ["scheduledAt", ""]]));
    expect(blank.scheduledAt).toBeUndefined();
  });

  it("throws ZodError when slug fails the kebab-case pattern", () => {
    expect(() =>
      postCreateFromFormData(
        fd([...required.filter(([k]) => k !== "slug"), ["slug", "Not Kebab"]]),
      ),
    ).toThrow(ZodError);
  });

  it("throws ZodError when body is empty", () => {
    expect(() =>
      postCreateFromFormData(fd([...required.filter(([k]) => k !== "body"), ["body", ""]])),
    ).toThrow(ZodError);
  });
});
