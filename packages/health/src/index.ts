/**
 * @repo/health: pure scoring + recommendation logic for the PBN
 * dashboard. No I/O, no Prisma writes; callers (worker, web) supply
 * the data.
 */

export { computeHealthScore, type ScoreInputs } from "./score";
export {
  buildRecommendations,
  type Recommendation,
  type RecommendationContext,
  type RecommendationPriority,
} from "./recommendations";
export {
  SEO_DESCRIPTION_MAX,
  SEO_DESCRIPTION_MIN,
  SEO_TITLE_MAX,
  SEO_TITLE_MIN,
  classifyDescriptionLength,
  classifyTitleLength,
  onPageIssuesForPost,
  summarizeOnPage,
  type OnPageCounts,
  type OnPageIssueKind,
  type OnPagePostInput,
  type SeoLengthIssue,
} from "./on-page";
