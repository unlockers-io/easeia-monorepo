import type { FixAdvice } from "@repo/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createGetFixAdviceAction } from "./fix-advice-action-service";
import {
  callGenerator,
  getCachedAdvice,
  resetFixAdviceCacheForTests,
  resetFixAdviceGeneratorForTests,
  setCachedAdvice,
  setFixAdviceGeneratorForTests,
} from "./fix-advice-cache";

const findMock = vi.fn();

const baseAdvice: FixAdvice = {
  autoApplyable: false,
  category: "hosting",
  problem:
    "The server is not setting a Content-Encoding header, so responses ship uncompressed and load slower than they should.",
  severity: "medium",
  steps: [
    {
      description: "Enable gzip in the Hostinger hPanel under Advanced > Cache.",
      manual: true,
      snippet: null,
    },
  ],
};

const getFixAdviceAction = createGetFixAdviceAction({
  findSite: findMock,
  generate: callGenerator,
  getCached: getCachedAdvice,
  getSession: vi.fn().mockResolvedValue({ user: { id: "user_1" } }),
  logError: () => {},
  setCached: setCachedAdvice,
});

describe("getFixAdviceAction", () => {
  beforeEach(() => {
    findMock.mockReset();
    findMock.mockResolvedValue({
      domain: "example.com",
      id: "site_1",
      niches: ["WEDDING"],
    });
    resetFixAdviceCacheForTests();
    resetFixAdviceGeneratorForTests();
  });

  it("returns the advice and forwards site context + check name to the generator", async () => {
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    const result = await getFixAdviceAction({
      checkName: "no_content_encoding",
      siteId: "site_1",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.data).toEqual(baseAdvice);
    expect(generator).toHaveBeenCalledTimes(1);
    expect(generator).toHaveBeenCalledWith({
      checkName: "no_content_encoding",
      site: { domain: "example.com", niches: ["WEDDING"] },
    });
  });

  it("caches results by (siteId, checkName) and skips the generator on repeat calls", async () => {
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    await getFixAdviceAction({ checkName: "is_redirect", siteId: "site_1" });
    await getFixAdviceAction({ checkName: "is_redirect", siteId: "site_1" });

    expect(generator).toHaveBeenCalledTimes(1);
  });

  it("treats different check names as separate cache entries for the same site", async () => {
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    await getFixAdviceAction({ checkName: "is_redirect", siteId: "site_1" });
    await getFixAdviceAction({ checkName: "is_4xx_code", siteId: "site_1" });

    expect(generator).toHaveBeenCalledTimes(2);
  });

  it("treats different sites with the same check name as separate cache entries", async () => {
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    findMock.mockResolvedValueOnce({
      domain: "example.com",
      id: "site_1",
      niches: [],
    });
    findMock.mockResolvedValueOnce({
      domain: "other.com",
      id: "site_2",
      niches: [],
    });

    await getFixAdviceAction({ checkName: "is_redirect", siteId: "site_1" });
    await getFixAdviceAction({ checkName: "is_redirect", siteId: "site_2" });

    expect(generator).toHaveBeenCalledTimes(2);
  });

  it("rejects malformed check names without calling the generator", async () => {
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    const result = await getFixAdviceAction({
      checkName: "DROP TABLE sites;",
      siteId: "site_1",
    });

    expect(result.ok).toBe(false);
    expect(generator).not.toHaveBeenCalled();
  });

  it("returns an error when the site does not exist", async () => {
    findMock.mockResolvedValueOnce(null);
    const generator = vi.fn(() => Promise.resolve(baseAdvice));
    setFixAdviceGeneratorForTests(generator);

    const result = await getFixAdviceAction({
      checkName: "no_content_encoding",
      siteId: "missing",
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error).toBe("Site not found.");
    expect(generator).not.toHaveBeenCalled();
  });
});
