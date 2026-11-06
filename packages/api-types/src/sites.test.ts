import { describe, expect, it } from "vitest";

import {
  siteCreateSchema,
  siteDomainSchema,
  siteUpdatePatchSchema,
  deployHookUrlSchema,
} from "./sites";

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
