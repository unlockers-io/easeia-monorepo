import { setTimeout as sleep } from "node:timers/promises";

import type { SiteLanguage } from "@repo/db";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Fetch } from "./client";
import {
  backlinksSummaryResponse,
  domainRankOverviewResponse,
  instantPagesResponse,
  insufficientFundsResponse,
  rankedKeywordsResponse,
  serpOrganicResponse,
  taskErrorResponse,
} from "./fixtures";

import { createDataForSeo, DataForSeoError, DataForSeoNotConfiguredError } from "./index";

const replyWith = (response: Response) => vi.fn<Fetch>(() => Promise.resolve(response.clone()));

const clientFor = (fetch: Fetch, timeoutMs = 1000) => createDataForSeo({ fetch, timeoutMs });

const sentBody = (fetch: ReturnType<typeof replyWith>) => {
  const init = fetch.mock.calls[0]?.[1];
  return typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
};

const site = (language: SiteLanguage) => ({
  domain: "https://casamento.example.com.br/",
  language,
});

beforeEach(() => {
  vi.stubEnv("DATAFORSEO_LOGIN", "operator@example.com");
  vi.stubEnv("DATAFORSEO_PASSWORD", "api-key");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("market", () => {
  it.each([
    ["EN", 2840, "en", "United States, English"],
    ["ES", 2724, "es", "Spain, Spanish"],
    ["PT", 2076, "pt", "Brazil, Portuguese"],
  ] as const)(
    "queries %s sites in their own market",
    async (language, locationCode, languageCode, name) => {
      const serpFetch = replyWith(Response.json(serpOrganicResponse));
      const rankFetch = replyWith(Response.json(domainRankOverviewResponse));
      const keywordsFetch = replyWith(Response.json(rankedKeywordsResponse));

      const serp = await clientFor(serpFetch).serpOrganic(site(language), "casamento na praia");
      await clientFor(rankFetch).domainRankOverview(site(language));
      await clientFor(keywordsFetch).rankedKeywords(site(language), 10);

      expect(serp.market).toBe(name);
      for (const fetch of [serpFetch, rankFetch, keywordsFetch]) {
        expect(sentBody(fetch)).toEqual([
          expect.objectContaining({ language_code: languageCode, location_code: locationCode }),
        ]);
      }
    },
  );
});

describe("response mapping", () => {
  it("summarizes an on-page audit and classifies every failed check", async () => {
    const fetch = replyWith(Response.json(instantPagesResponse));

    const audit = await clientFor(fetch).auditPage("https://casamento.example.com.br/praia/");

    expect(fetch.mock.calls[0]?.[0]).toBe("https://api.dataforseo.com/v3/on_page/instant_pages");
    expect(audit).toEqual({
      checks: {
        failed: [
          { actionable: false, label: "from_sitemap", name: "from_sitemap" },
          {
            actionable: false,
            label: "has_render_blocking_resources",
            name: "has_render_blocking_resources",
          },
          { actionable: true, label: "Missing meta description", name: "no_description" },
          { actionable: true, label: "Images missing alt", name: "no_image_alt" },
        ],
        passed: 5,
      },
      externalLinks: 4,
      imagesCount: 11,
      internalLinks: 37,
      largestContentfulPaintMs: 1203,
      onpageScore: 87.42,
      timeToInteractiveMs: 1611,
      url: "https://casamento.example.com.br/praia/",
      wordCount: 842,
    });
  });

  it("maps the domain rank distribution and estimated organic traffic", async () => {
    const fetch = replyWith(Response.json(domainRankOverviewResponse));

    const overview = await clientFor(fetch).domainRankOverview(site("PT"));

    expect(sentBody(fetch)).toEqual([
      { language_code: "pt", location_code: 2076, target: "casamento.example.com.br" },
    ]);
    expect(overview).toEqual({
      organicKeywords: 1873,
      organicTraffic: 2431.8,
      pos1: 14,
      pos11to20: 301,
      pos2to3: 52,
      pos4to10: 188,
    });
  });

  it("maps ranked keywords, keeping missing metrics empty", async () => {
    const fetch = replyWith(Response.json(rankedKeywordsResponse));

    const keywords = await clientFor(fetch).rankedKeywords(site("PT"), 10);

    expect(sentBody(fetch)).toEqual([
      expect.objectContaining({ limit: 10, target: "casamento.example.com.br" }),
    ]);
    expect(keywords).toEqual([
      {
        cpc: 1.42,
        keyword: "casamento na praia",
        rank: 3,
        searchVolume: 6600,
        url: "https://casamento.example.com.br/praia/",
      },
      { cpc: null, keyword: "vestido de noiva praia", rank: 14, searchVolume: null, url: null },
    ]);
  });

  it("maps the backlink summary", async () => {
    const fetch = replyWith(Response.json(backlinksSummaryResponse));

    const summary = await clientFor(fetch).backlinkSummary("casamento.example.com.br");

    expect(sentBody(fetch)).toEqual([{ target: "casamento.example.com.br" }]);
    expect(summary).toEqual({ backlinks: 3456, referringDomains: 87 });
  });

  it("keeps titled organic results and matches the site's own position", async () => {
    const fetch = replyWith(Response.json(serpOrganicResponse));

    const serp = await clientFor(fetch).serpOrganic(site("PT"), "casamento na praia");

    expect(sentBody(fetch)).toEqual([
      expect.objectContaining({ depth: 20, keyword: "casamento na praia" }),
    ]);
    const own = {
      description: null,
      domain: "casamento.example.com.br",
      rank: 3,
      title: "Casamento na praia: guia completo",
      url: "https://casamento.example.com.br/praia/",
    };
    expect(serp).toEqual({
      market: "Brazil, Portuguese",
      matched: own,
      top: [
        {
          description: "Tudo sobre casamento na praia.",
          domain: "www.concorrente.com.br",
          rank: 1,
          title: "Casamento na praia: 10 dicas",
          url: "https://www.concorrente.com.br/praia",
        },
        own,
      ],
    });
  });

  it("returns empty results when a task has no result rows", async () => {
    const noResult = {
      ...taskErrorResponse,
      tasks: [{ ...taskErrorResponse.tasks[0], status_code: 20_000, status_message: "Ok." }],
    };
    const client = clientFor(replyWith(Response.json(noResult)));

    await expect(client.backlinkSummary("casamento.example.com.br")).resolves.toBeNull();
    await expect(client.auditPage("https://casamento.example.com.br/")).resolves.toBeNull();
    await expect(client.rankedKeywords(site("EN"), 10)).resolves.toEqual([]);
  });
});

describe("failures", () => {
  it("rejects missing credentials before fetching", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", "");
    const fetch = replyWith(Response.json(backlinksSummaryResponse));

    const result = clientFor(fetch).backlinkSummary("casamento.example.com.br");

    await expect(result).rejects.toBeInstanceOf(DataForSeoNotConfiguredError);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("authenticates with the configured login and API password", async () => {
    const fetch = replyWith(Response.json(backlinksSummaryResponse));

    await clientFor(fetch).backlinkSummary("casamento.example.com.br");

    expect(fetch.mock.calls[0]?.[1].headers).toMatchObject({
      Authorization: `Basic ${Buffer.from("operator@example.com:api-key").toString("base64")}`,
    });
  });

  it("times out a request that never answers", async () => {
    const fetch = vi.fn<Fetch>(async (_url, init) => {
      await sleep(60_000, undefined, { signal: init.signal ?? undefined });
      return new Response();
    });

    const result = clientFor(fetch, 5).backlinkSummary("casamento.example.com.br");

    await expect(result).rejects.toThrow(new DataForSeoError(504, "no response within 5ms"));
  });

  it.each([
    [
      "network failure",
      vi.fn<Fetch>(() => Promise.reject(new TypeError("fetch failed"))),
      502,
      "fetch failed",
    ],
    ["HTTP error", replyWith(new Response("Unauthorized", { status: 401 })), 401, "Unauthorized"],
    [
      "non-JSON body",
      replyWith(new Response("<html>bad gateway</html>")),
      502,
      "response is not JSON",
    ],
    ["unexpected shape", replyWith(Response.json({ tasks: [] })), 502, "unexpected response shape"],
    [
      "account-level status",
      replyWith(Response.json(insufficientFundsResponse)),
      40_200,
      "Payment Required.",
    ],
    [
      "task-level status",
      replyWith(Response.json(taskErrorResponse)),
      40_501,
      "Invalid Field: 'location_code'.",
    ],
  ])("maps a %s to a DataForSeoError", async (_name, fetch, status, message) => {
    const result = clientFor(fetch).backlinkSummary("casamento.example.com.br");

    await expect(result).rejects.toThrow(new DataForSeoError(status, message));
    await expect(result).rejects.toMatchObject({ status });
  });
});
