import { describe, expect, it } from "vitest";

import { computeHealthScore, type ScoreInputs } from "./score";

const baseInputs: ScoreInputs = {
  daysSinceLastPublish: null,
  domainRank: null,
  gscAvgPosition: null,
  gscClicks: null,
  postsLast30d: 0,
  reachable: true,
  referringDomains: null,
};

describe("computeHealthScore", () => {
  it("returns null when site is unreachable", () => {
    expect(
      computeHealthScore({ ...baseInputs, domainRank: 80, postsLast30d: 12, reachable: false }),
    ).toBeNull();
  });

  it("returns null when no component has data", () => {
    expect(computeHealthScore(baseInputs)).toBeNull();
  });

  it("uses cadence alone when other components are missing", () => {
    const score = computeHealthScore({
      ...baseInputs,
      daysSinceLastPublish: 1,
      postsLast30d: 12,
    });
    expect(score).toBe(100);
  });

  it("halves cadence when last publish is older than 30 days", () => {
    const score = computeHealthScore({
      ...baseInputs,
      daysSinceLastPublish: 45,
      postsLast30d: 12,
    });
    expect(score).toBe(50);
  });

  it("blends authority components when both present", () => {
    const score = computeHealthScore({
      ...baseInputs,
      domainRank: 50,
      referringDomains: 99,
    });
    expect(score).toBe(56);
  });

  it("renormalizes weights so missing components don't tank the score", () => {
    const score = computeHealthScore({
      ...baseInputs,
      daysSinceLastPublish: 1,
      gscAvgPosition: 5,
      gscClicks: 1000,
      postsLast30d: 12,
    });
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("position bonus saturates at 100 for top-10 average position", () => {
    const score = computeHealthScore({
      ...baseInputs,
      gscAvgPosition: 3,
      gscClicks: 0,
    });
    expect(score).toBe(50);
  });

  it("position bonus zero for averages worse than 50", () => {
    const score = computeHealthScore({
      ...baseInputs,
      gscAvgPosition: 80,
      gscClicks: 0,
    });
    expect(score).toBe(0);
  });
});
