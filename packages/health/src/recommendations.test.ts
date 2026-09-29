import type { SiteSnapshot } from "@repo/db";
import { describe, expect, it } from "vitest";

import { buildRecommendations } from "./recommendations";

const baseSnapshot: SiteSnapshot = {
  backlinksTotal: 100,
  createdAt: new Date(),
  date: new Date("2026-05-01"),
  daysSinceLastPublish: 2,
  domainRank: 50,
  errors: {},
  gscAvgPosition: 12,
  gscClicks: 100,
  gscImpressions: 1000,
  healthScore: 75,
  id: "snap_1",
  onPageScore: 85,
  postsLast30d: 12,
  postsLast7d: 3,
  reachable: true,
  referringDomains: 20,
  siteId: "site_1",
};

describe("buildRecommendations", () => {
  it("returns no recommendations for a healthy site with no prior", () => {
    const recs = buildRecommendations({
      latest: baseSnapshot,
      prior: null,
      siteId: "site_1",
    });
    expect(recs).toEqual([]);
  });

  it("flags unreachable sites with priority 1", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, healthScore: null, reachable: false },
      prior: null,
      siteId: "site_1",
    });
    expect(recs[0]?.id).toBe("unreachable");
    expect(recs[0]?.priority).toBe(1);
  });

  it("flags stale publishing", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, daysSinceLastPublish: 45 },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("noPublishRecent");
  });

  it("flags week-over-week rank drops", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, domainRank: 40 },
      prior: { ...baseSnapshot, domainRank: 50 },
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("rankDropped");
  });

  it("does not flag rank drops smaller than 5", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, domainRank: 47 },
      prior: { ...baseSnapshot, domainRank: 50 },
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).not.toContain("rankDropped");
  });

  it("flags GSC click drops over 30%", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, gscClicks: 50 },
      prior: { ...baseSnapshot, gscClicks: 100 },
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("gscClicksDropped");
  });

  it("flags low on-page audit scores", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, onPageScore: 50 },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("lowOnPageScore");
  });

  it("suggests connecting GSC when explicitly not connected", () => {
    const recs = buildRecommendations({
      latest: {
        ...baseSnapshot,
        errors: { gsc: "not_connected" },
        gscAvgPosition: null,
        gscClicks: null,
        gscImpressions: null,
      },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("gscNotConnected");
  });

  it("does not suggest connecting GSC when the failure is something else", () => {
    const recs = buildRecommendations({
      latest: {
        ...baseSnapshot,
        errors: { gsc: "rate_limited" },
        gscImpressions: null,
      },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).not.toContain("gscNotConnected");
  });

  it("does not treat malformed GSC errors as not connected", () => {
    const recs = buildRecommendations({
      latest: {
        ...baseSnapshot,
        errors: { gsc: 42 },
        gscImpressions: null,
      },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).not.toContain("gscNotConnected");
  });

  it("flags low referring domains", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, referringDomains: 2 },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("noRefDomains");
  });

  it("flags low cadence", () => {
    const recs = buildRecommendations({
      latest: { ...baseSnapshot, postsLast30d: 2 },
      prior: null,
      siteId: "site_1",
    });
    expect(recs.map((r) => r.id)).toContain("lowCadence");
  });

  it("returns at most three recommendations, priority-sorted", () => {
    const recs = buildRecommendations({
      latest: {
        ...baseSnapshot,
        daysSinceLastPublish: 60,
        healthScore: null,
        onPageScore: 30,
        postsLast30d: 1,
        reachable: false,
        referringDomains: 1,
      },
      prior: null,
      siteId: "site_1",
    });
    expect(recs).toHaveLength(3);
    expect(recs[0]?.priority).toBeLessThanOrEqual(recs[1]?.priority ?? 99);
    expect(recs[1]?.priority).toBeLessThanOrEqual(recs[2]?.priority ?? 99);
  });
});
