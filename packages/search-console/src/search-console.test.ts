import { beforeEach, describe, expect, it, vi } from "vitest";

const inspectMock = vi.fn();
const sitesListMock = vi.fn();
const queryMock = vi.fn();

import { createSearchConsoleOperations } from "./search-console";

const { inspectUrl, resolveSiteUrl } = createSearchConsoleOperations(() =>
  Promise.resolve({
    searchanalytics: { query: queryMock },
    sites: { list: sitesListMock },
    urlInspection: { index: { inspect: inspectMock } },
  }),
);

const ctx = { redirectUri: "https://example.test/callback", userId: "user_1" };

beforeEach(() => {
  inspectMock.mockReset();
  sitesListMock.mockReset();
});

describe("inspectUrl", () => {
  it("returns the referring URLs sample and coverage state when present", async () => {
    inspectMock.mockResolvedValueOnce({
      data: {
        inspectionResult: {
          indexStatusResult: {
            coverageState: "Indexed, not submitted in sitemap",
            referringUrls: ["https://forbes.com/a", "https://nytimes.com/b"],
          },
        },
      },
    });

    const result = await inspectUrl(ctx, {
      inspectionUrl: "https://easeia.dev/post-1/",
      sitePropertyUrl: "sc-domain:easeia.dev",
    });

    expect(result.referringUrls).toEqual(["https://forbes.com/a", "https://nytimes.com/b"]);
    expect(result.coverageState).toBe("Indexed, not submitted in sitemap");
    expect(inspectMock).toHaveBeenCalledWith({
      requestBody: {
        inspectionUrl: "https://easeia.dev/post-1/",
        languageCode: "en-US",
        siteUrl: "sc-domain:easeia.dev",
      },
    });
  });

  it("defaults to empty referringUrls when GSC omits the field", async () => {
    inspectMock.mockResolvedValueOnce({
      data: { inspectionResult: { indexStatusResult: {} } },
    });

    const result = await inspectUrl(ctx, {
      inspectionUrl: "https://easeia.dev/post-2/",
      sitePropertyUrl: "sc-domain:easeia.dev",
    });

    expect(result.referringUrls).toEqual([]);
    expect(result.coverageState).toBeNull();
  });

  it("forwards a custom languageCode when provided", async () => {
    inspectMock.mockResolvedValueOnce({
      data: { inspectionResult: { indexStatusResult: { referringUrls: [] } } },
    });

    await inspectUrl(ctx, {
      inspectionUrl: "https://easeia.dev/post-3/",
      languageCode: "pt-BR",
      sitePropertyUrl: "sc-domain:easeia.dev",
    });

    expect(inspectMock.mock.calls[0]?.[0]).toMatchObject({
      requestBody: { languageCode: "pt-BR" },
    });
  });
});

describe("resolveSiteUrl", () => {
  it("returns the sc-domain candidate when verified", async () => {
    sitesListMock.mockResolvedValueOnce({
      data: { siteEntry: [{ permissionLevel: "siteOwner", siteUrl: "sc-domain:easeia.dev" }] },
    });

    const result = await resolveSiteUrl(ctx, "easeia.dev");

    expect(result).toBe("sc-domain:easeia.dev");
  });

  it("returns null when no candidate matches", async () => {
    sitesListMock.mockResolvedValueOnce({ data: { siteEntry: [] } });

    const result = await resolveSiteUrl(ctx, "unknown.test");

    expect(result).toBeNull();
  });
});
