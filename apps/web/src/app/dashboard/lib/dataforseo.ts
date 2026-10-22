import { dataForSeo, DataForSeoError } from "@repo/dataforseo";
import type { SiteLanguage } from "@repo/db";
import { cacheLife } from "next/cache";

import { type ProviderResult, tryProvider } from "./provider-result";

const cached = async <T>(call: () => Promise<T>): Promise<ProviderResult<T>> => {
  const outcome = await tryProvider(call, [DataForSeoError]);

  if (outcome.ok) {
    cacheLife("hours");
  } else {
    cacheLife("minutes");
  }

  return outcome;
};

export const auditPage = async (url: string) => {
  "use cache: remote";

  return cached(() => dataForSeo.auditPage(url));
};

export const domainRankOverview = async (domain: string, language: SiteLanguage) => {
  "use cache: remote";

  return cached(() => dataForSeo.domainRankOverview({ domain, language }));
};

export const rankedKeywords = async (domain: string, language: SiteLanguage, limit: number) => {
  "use cache: remote";

  return cached(() => dataForSeo.rankedKeywords({ domain, language }, limit));
};

export const serpOrganic = async (domain: string, language: SiteLanguage, keyword: string) => {
  "use cache: remote";

  return cached(() => dataForSeo.serpOrganic({ domain, language }, keyword));
};
