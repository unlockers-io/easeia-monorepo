type ScoreInputs = {
  daysSinceLastPublish: number | null;
  domainRank: number | null;
  gscAvgPosition: number | null;
  gscClicks: number | null;
  postsLast30d: number;
  reachable: boolean;
  referringDomains: number | null;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const cadenceScore = ({
  daysSinceLastPublish,
  postsLast30d,
}: Pick<ScoreInputs, "postsLast30d" | "daysSinceLastPublish">): number | null => {
  if (postsLast30d === 0 && daysSinceLastPublish === null) {
    return null;
  }
  const base = clamp((postsLast30d / 12) * 100, 0, 100);
  const stale = daysSinceLastPublish !== null && daysSinceLastPublish > 30;
  return Math.round(stale ? base / 2 : base);
};

const authorityScore = ({
  domainRank,
  referringDomains,
}: Pick<ScoreInputs, "domainRank" | "referringDomains">): number | null => {
  if (domainRank === null && referringDomains === null) {
    return null;
  }
  const rankPart = domainRank === null ? null : clamp(domainRank, 0, 100);
  const refsPart =
    referringDomains === null ? null : clamp(Math.log10(referringDomains + 1) * 33, 0, 100);

  if (rankPart !== null && refsPart !== null) {
    return Math.round(rankPart * 0.6 + refsPart * 0.4);
  }
  return Math.round(rankPart ?? refsPart ?? 0);
};

const positionToScore = (avgPos: number): number => {
  if (avgPos <= 10) {
    return 100;
  }
  if (avgPos >= 50) {
    return 0;
  }
  return clamp(((50 - avgPos) / 40) * 100, 0, 100);
};

const searchScore = ({
  gscAvgPosition,
  gscClicks,
}: Pick<ScoreInputs, "gscClicks" | "gscAvgPosition">): number | null => {
  if (gscClicks === null && gscAvgPosition === null) {
    return null;
  }
  const clicksPart = gscClicks === null ? null : clamp(Math.log10(gscClicks + 1) * 25, 0, 100);
  const positionPart = gscAvgPosition === null ? null : positionToScore(gscAvgPosition);

  if (clicksPart !== null && positionPart !== null) {
    return Math.round(clicksPart * 0.5 + positionPart * 0.5);
  }
  return Math.round(clicksPart ?? positionPart ?? 0);
};

const computeHealthScore = (inputs: ScoreInputs): number | null => {
  if (!inputs.reachable) {
    return null;
  }

  const components = [
    { score: cadenceScore(inputs), weight: 30 },
    { score: authorityScore(inputs), weight: 40 },
    { score: searchScore(inputs), weight: 30 },
  ].filter((c): c is { score: number; weight: number } => c.score !== null);

  if (components.length === 0) {
    return null;
  }

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const weighted = components.reduce((sum, c) => sum + c.score * c.weight, 0);
  return Math.round(weighted / totalWeight);
};

export { computeHealthScore };
export type { ScoreInputs };
