import { describe, expect, it, vi } from "vitest";

import { createSite } from "./create";
import { SiteDomainTakenError } from "./errors";
import { fakeSite } from "./fake";

const input = {
  domain: "https://photo-blog.example/news",
  isEnabled: true,
  language: "EN",
  niches: [],
} as const;

describe("Sites.create", () => {
  it("normalizes the domain before inserting", async () => {
    const insert = vi.fn(() => Promise.resolve(fakeSite()));
    await createSite(insert)({ ...input, niches: [] });
    expect(insert).toHaveBeenCalledWith({ ...input, domain: "photo-blog.example", niches: [] });
  });
  it("maps uniqueness conflicts to a typed domain error", async () => {
    const insert = vi.fn().mockRejectedValue({ code: "P2002" });
    await expect(createSite(insert)({ ...input, niches: [] })).rejects.toBeInstanceOf(
      SiteDomainTakenError,
    );
  });
});
