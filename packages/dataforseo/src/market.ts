import type { SiteLanguage } from "@repo/db";

type Market = {
  languageCode: string;
  locationCode: number;
  name: string;
};

const MARKETS = {
  EN: { languageCode: "en", locationCode: 2840, name: "United States, English" },
  ES: { languageCode: "es", locationCode: 2724, name: "Spain, Spanish" },
  PT: { languageCode: "pt", locationCode: 2076, name: "Brazil, Portuguese" },
} satisfies Record<SiteLanguage, Market>;

export type MarketSite = {
  domain: string;
  language: SiteLanguage;
};

export const marketName = (language: SiteLanguage): string => MARKETS[language].name;

export const marketParams = (language: SiteLanguage) => ({
  language_code: MARKETS[language].languageCode,
  location_code: MARKETS[language].locationCode,
});
