export { GoogleAuthError, GoogleNotConfiguredError, GoogleNotConnectedError } from "./errors";
export { isGoogleConfigured, buildAuthUrl, exchangeCode, SEARCH_CONSOLE_SCOPE } from "./oauth";
export { disconnect, loadConnection, storeConnection, type GoogleConnectionPublic } from "./tokens";
export {
  inspectUrl,
  listVerifiedSites,
  pagePerformance,
  resolveSiteUrl,
  topPages,
  topQueries,
  totals,
  type PagePerformance,
  type SearchAnalyticsTotals,
  type TopPage,
  type TopQuery,
  type UrlInspectionResult,
  type VerifiedSite,
} from "./search-console";
