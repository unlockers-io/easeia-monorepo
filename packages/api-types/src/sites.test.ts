import { Niche } from "@repo/db";
import { describe, expect, it } from "vitest";

import {
  siteCreateSchema,
  siteDomainSchema,
  siteUpdatePatchSchema,
  deployHookUrlSchema,
  siteUpdateFromFormData,
} from "./sites";

const fd = (entries: Array<[string, string]>): FormData => {
  const form = new FormData();
  for (const [k, v] of entries) {
    form.append(k, v);
  }
  return form;
};

describe("siteUpdateFromFormData", () => {
  it("extracts id + isEnabled + niches from FormData", () => {
    const form = fd([
      ["id", "site-1"],
      ["isEnabled", "on"],
    ]);
    form.append("niches", Niche.PHOTOGRAPHY);
    form.append("niches", Niche.WEDDING);
    expect(siteUpdateFromFormData(form)).toEqual({
      id: "site-1",
      patch: {
        isEnabled: true,
        niches: [Niche.PHOTOGRAPHY, Niche.WEDDING],
      },
    });
  });

  it("treats missing isEnabled as false", () => {
    expect(siteUpdateFromFormData(fd([["id", "x"]])).patch.isEnabled).toBe(false);
  });

  it("returns empty niches array when no niche keys present", () => {
    expect(siteUpdateFromFormData(fd([["id", "x"]])).patch.niches).toEqual([]);
  });

  it("throws when id is missing", () => {
    expect(() => siteUpdateFromFormData(fd([]))).toThrow("Site update requires id");
  });

  it("parses defaultCategory + categorySlugMap when present", () => {
    const form = fd([
      ["id", "x"],
      ["defaultCategory", " geral "],
      ["categorySlugMap", JSON.stringify({ "Edição de Vídeo": "video" })],
    ]);
    const { patch } = siteUpdateFromFormData(form);
    expect(patch.defaultCategory).toBe("geral");
    expect(patch.categorySlugMap).toEqual({ "Edição de Vídeo": "video" });
  });

  it("omits the category fields when absent (never blanks stored values)", () => {
    const { patch } = siteUpdateFromFormData(fd([["id", "x"]]));
    expect(patch.defaultCategory).toBeUndefined();
    expect(patch.categorySlugMap).toBeUndefined();
  });

  it("ignores a malformed categorySlugMap rather than throwing", () => {
    const { patch } = siteUpdateFromFormData(
      fd([
        ["id", "x"],
        ["categorySlugMap", "{not json"],
      ]),
    );
    expect(patch.categorySlugMap).toBeUndefined();
  });
});

describe("site intake", () => {
  it("normalizes pasted domains and applies create defaults", () => {
    expect(siteCreateSchema.parse({ domain: " HTTPS://Photo-Blog.Example/posts " })).toEqual({
      domain: "photo-blog.example",
      isEnabled: true,
      language: "PT",
      niches: [],
    });
  });
  it.each(["", "bad domain", "https://user:password@photo-blog.example", "file:///tmp/site"])(
    "rejects invalid domain %s",
    (domain) => {
      expect(siteDomainSchema.safeParse(domain).success).toBe(false);
    },
  );
  it("patches never apply create defaults", () => {
    expect(siteUpdatePatchSchema.parse({ vercelProjectName: "photos" })).toEqual({
      vercelProjectName: "photos",
    });
  });
  it("accepts HTTP hooks, clears blanks, and rejects other schemes", () => {
    expect(deployHookUrlSchema.parse(" ")).toBeNull();
    expect(deployHookUrlSchema.parse("https://deploy.example/hook")).toBe(
      "https://deploy.example/hook",
    );
    expect(deployHookUrlSchema.safeParse("file:///tmp/hook").success).toBe(false);
  });
});
