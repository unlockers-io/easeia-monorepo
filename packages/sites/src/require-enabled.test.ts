import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeSite } from "./fake";

const findUnique = vi.fn();

import { createRequireEnabled, SiteDisabledError, SiteNotFoundError } from "./index";

const requireEnabled = createRequireEnabled(findUnique);

const baseSite = fakeSite();

describe("Sites.requireEnabled", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("returns the Site when it exists and is enabled", async () => {
    findUnique.mockResolvedValue({ ...baseSite, isEnabled: true });
    const result = await requireEnabled("site_1");
    expect(result.id).toBe("site_1");
    expect(result.isEnabled).toBe(true);
  });

  it("throws SiteNotFoundError when the Site row is missing", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireEnabled("missing")).rejects.toBeInstanceOf(SiteNotFoundError);
  });

  it("throws SiteDisabledError when the Site exists but isEnabled is false", async () => {
    findUnique.mockResolvedValue({ ...baseSite, isEnabled: false });
    await expect(requireEnabled("site_1")).rejects.toBeInstanceOf(SiteDisabledError);
  });

  it("includes the Site domain in the SiteDisabledError message", async () => {
    findUnique.mockResolvedValue({ ...baseSite, domain: "blog.example.com", isEnabled: false });
    await expect(requireEnabled("site_1")).rejects.toThrow(/blog\.example\.com/v);
  });

  it("checks not-found before disabled (a missing Site is never 'disabled')", async () => {
    findUnique.mockResolvedValue(null);
    await expect(requireEnabled("ghost")).rejects.toBeInstanceOf(SiteNotFoundError);
  });
});
