import { randomBytes } from "node:crypto";

import { prisma } from "@repo/db";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GoogleAuthError } from "./errors";
import type { Google, SearchConsoleApi } from "./google";
import { createSearchConsole, isConnected } from "./search-console";
import { storeConnection } from "./tokens";

const HOUR_MS = 3_600_000;
const USER_ID = "search-console-test-user";

const fakeGoogle = (verified: ReadonlyArray<string> = ["sc-domain:easeia.dev"]) => {
  const api = {
    inspect: vi.fn<SearchConsoleApi["inspect"]>().mockResolvedValue({}),
    listSites: vi.fn<SearchConsoleApi["listSites"]>().mockResolvedValue({
      siteEntry: verified.map((siteUrl) => ({ permissionLevel: "siteOwner", siteUrl })),
    }),
    query: vi.fn<SearchConsoleApi["query"]>().mockResolvedValue({}),
  };

  return {
    api,
    refreshAccessToken: vi.fn<Google["refreshAccessToken"]>(() =>
      Promise.resolve({ access_token: "refreshed-access", expiry_date: Date.now() + HOUR_MS }),
    ),
    searchConsole: vi.fn<Google["searchConsole"]>(() => api),
  };
};

const connect = (expiresAt: number) =>
  storeConnection({
    googleEmail: "owner@easeia.dev",
    tokens: {
      access_token: "stored-access",
      expiry_date: expiresAt,
      refresh_token: "stored-refresh",
    },
    userId: USER_ID,
  });

const connectedSite = async (google: Google, domain = "easeia.dev") => {
  const site = await createSearchConsole(google).forSite(domain);

  if (site.status !== "ok") {
    throw new Error(`expected a connected site, got ${site.status}`);
  }

  return site;
};

describe.runIf(process.env.TEST_DATABASE === "true")("Search Console", () => {
  beforeAll(async () => {
    vi.stubEnv("WP_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    await prisma.user.upsert({
      create: { email: "search-console-test@easeia.dev", id: USER_ID },
      update: {},
      where: { id: USER_ID },
    });
  });

  beforeEach(async () => {
    await prisma.googleConnection.deleteMany();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: USER_ID } });
    vi.unstubAllEnvs();
    await prisma.$disconnect();
  });

  describe("forSite", () => {
    it("reports not_connected when no Google account is connected", async () => {
      const google = fakeGoogle();

      const site = await createSearchConsole(google).forSite("easeia.dev");

      expect(site).toEqual({ status: "not_connected" });
      expect(google.searchConsole).not.toHaveBeenCalled();
    });

    it("reports not_verified when no candidate property is verified", async () => {
      await connect(Date.now() + HOUR_MS);

      const site = await createSearchConsole(fakeGoogle(["sc-domain:other.dev"])).forSite(
        "easeia.dev",
      );

      expect(site).toEqual({ status: "not_verified" });
    });

    it("prefers the domain property, then the https and http URL prefixes", async () => {
      await connect(Date.now() + HOUR_MS);

      const domain = await connectedSite(
        fakeGoogle(["https://easeia.dev/", "sc-domain:easeia.dev"]),
        "https://easeia.dev/",
      );

      const https = await connectedSite(fakeGoogle(["http://easeia.dev/", "https://easeia.dev/"]));
      const http = await connectedSite(fakeGoogle(["http://easeia.dev/"]));

      expect([domain.property, https.property, http.property]).toEqual([
        "sc-domain:easeia.dev",
        "https://easeia.dev/",
        "http://easeia.dev/",
      ]);
    });

    it("uses a valid stored token without refreshing", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle();

      await connectedSite(google);

      expect(google.refreshAccessToken).not.toHaveBeenCalled();
      expect(google.searchConsole).toHaveBeenCalledWith("stored-access");
    });
  });

  describe("token refresh", () => {
    it("refreshes an expired token once across concurrent queries", async () => {
      await connect(Date.now() - 1000);
      const google = fakeGoogle();
      const searchConsole = createSearchConsole(google);

      const sites = await Promise.all([
        searchConsole.forSite("easeia.dev"),
        searchConsole.forSite("easeia.dev"),
        searchConsole.forSite("easeia.dev"),
      ]);

      const [site] = sites;

      if (site?.status !== "ok") {
        throw new Error("expected a connected site");
      }

      await Promise.all([site.totals(28), site.topQueries({ days: 28, limit: 10 })]);

      expect(sites.map((s) => s.status)).toEqual(["ok", "ok", "ok"]);
      expect(google.refreshAccessToken).toHaveBeenCalledTimes(1);
      expect(google.refreshAccessToken).toHaveBeenCalledWith("stored-refresh");
      expect(google.searchConsole.mock.calls.map(([token]) => token)).toEqual([
        "refreshed-access",
        "refreshed-access",
        "refreshed-access",
      ]);
    });

    it("persists the refreshed token encrypted so the next caller skips the refresh", async () => {
      await connect(Date.now() - 1000);

      await connectedSite(fakeGoogle());
      const row = await prisma.googleConnection.findUniqueOrThrow({ where: { userId: USER_ID } });
      const next = fakeGoogle();
      await connectedSite(next);

      expect(row.accessToken).not.toContain("refreshed-access");
      expect(row.refreshToken).not.toContain("stored-refresh");
      expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now());
      expect(next.refreshAccessToken).not.toHaveBeenCalled();
      expect(next.searchConsole).toHaveBeenCalledWith("refreshed-access");
    });

    it("retries a refresh after a failed one", async () => {
      await connect(Date.now() - 1000);
      const google = fakeGoogle();
      google.refreshAccessToken.mockRejectedValueOnce(new Error("invalid_grant"));
      const searchConsole = createSearchConsole(google);

      await expect(searchConsole.forSite("easeia.dev")).rejects.toThrow("invalid_grant");
      const site = await searchConsole.forSite("easeia.dev");

      expect(site.status).toBe("ok");
      expect(google.refreshAccessToken).toHaveBeenCalledTimes(2);
    });

    it("rejects a refresh that returns no access token", async () => {
      await connect(Date.now() - 1000);
      const google = fakeGoogle();
      google.refreshAccessToken.mockResolvedValueOnce({});

      await expect(createSearchConsole(google).forSite("easeia.dev")).rejects.toBeInstanceOf(
        GoogleAuthError,
      );
    });
  });

  describe("site queries", () => {
    it("maps totals and returns null for a window without rows", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle();
      google.api.query
        .mockResolvedValueOnce({
          rows: [{ clicks: 12, ctr: 0.1, impressions: 120, position: 4.2 }],
        })
        .mockResolvedValueOnce({ rows: [] });
      const site = await connectedSite(google);

      expect(await site.totals(7)).toEqual({
        clicks: 12,
        ctr: 0.1,
        impressions: 120,
        position: 4.2,
      });
      expect(await site.totals(7)).toBeNull();
      expect(google.api.query).toHaveBeenCalledWith(
        "sc-domain:easeia.dev",
        expect.objectContaining({
          endDate: expect.any(String),
          rowLimit: 1,
          startDate: expect.any(String),
        }),
      );
    });

    it("maps top queries and pages, skipping rows without a key", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle();
      google.api.query
        .mockResolvedValueOnce({
          rows: [
            { clicks: 3, ctr: 0.3, impressions: 10, keys: ["wedding photographer"], position: 2 },
            { clicks: 1, keys: [""] },
            { clicks: 1 },
          ],
        })
        .mockResolvedValueOnce({
          rows: [{ impressions: 40, keys: ["https://easeia.dev/a/"], position: 8 }],
        });
      const site = await connectedSite(google);

      const queries = await site.topQueries({ days: 28, limit: 10 });
      const pages = await site.topPages({ days: 90, limit: 100 });

      expect(queries).toEqual([
        { clicks: 3, ctr: 0.3, impressions: 10, position: 2, query: "wedding photographer" },
      ]);
      expect(pages).toEqual([
        { clicks: 0, ctr: 0, impressions: 40, page: "https://easeia.dev/a/", position: 8 },
      ]);
      expect(
        google.api.query.mock.calls.map(([, body]) => [body.dimensions, body.rowLimit]),
      ).toEqual([
        [["query"], 10],
        [["page"], 100],
      ]);
    });

    it("filters page performance to the page URL", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle();
      google.api.query.mockResolvedValueOnce({ rows: [{ clicks: 5, impressions: 50 }] });
      const site = await connectedSite(google);

      const performance = await site.pagePerformance("https://easeia.dev/a/", 28);

      expect(performance).toEqual({ clicks: 5, ctr: 0, impressions: 50, position: 0 });
      expect(google.api.query.mock.calls[0]?.[1].dimensionFilterGroups).toEqual([
        {
          filters: [{ dimension: "page", expression: "https://easeia.dev/a/", operator: "equals" }],
        },
      ]);
    });

    it("maps URL inspection results against the resolved property", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle();
      google.api.inspect
        .mockResolvedValueOnce({
          inspectionResult: {
            indexStatusResult: {
              coverageState: "Submitted and indexed",
              referringUrls: ["https://forbes.com/a"],
            },
          },
        })
        .mockResolvedValueOnce({ inspectionResult: { indexStatusResult: {} } });
      const site = await connectedSite(google);

      const indexed = await site.inspectUrl("https://easeia.dev/a/");
      const unknown = await site.inspectUrl("https://easeia.dev/b/");

      expect(indexed).toEqual({
        coverageState: "Submitted and indexed",
        referringUrls: ["https://forbes.com/a"],
      });
      expect(unknown).toEqual({ coverageState: null, referringUrls: [] });
      expect(google.api.inspect).toHaveBeenCalledWith({
        inspectionUrl: "https://easeia.dev/a/",
        languageCode: "en-US",
        siteUrl: "sc-domain:easeia.dev",
      });
    });
  });

  describe("isConnected", () => {
    it("reflects whether any Google account is connected", async () => {
      const before = await isConnected();
      await connect(Date.now() + HOUR_MS);

      expect([before, await isConnected()]).toEqual([false, true]);
    });
  });

  describe("listVerifiedSites", () => {
    it("lists the properties of a user's connection", async () => {
      await connect(Date.now() + HOUR_MS);
      const google = fakeGoogle(["sc-domain:easeia.dev", "https://other.dev/"]);

      const sites = await createSearchConsole(google).listVerifiedSites(USER_ID);

      expect(sites).toEqual([
        { permission: "siteOwner", siteUrl: "sc-domain:easeia.dev" },
        { permission: "siteOwner", siteUrl: "https://other.dev/" },
      ]);
    });

    it("returns no properties for a user without a connection", async () => {
      expect(await createSearchConsole(fakeGoogle()).listVerifiedSites(USER_ID)).toEqual([]);
    });
  });
});
