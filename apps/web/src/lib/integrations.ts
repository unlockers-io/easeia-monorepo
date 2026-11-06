import { AI_ENV_VARS } from "@repo/ai";
import { MAIL_ENV_VARS } from "@repo/auth/env";
import { R2_ENV_VARS } from "@repo/blob";
import { DATAFORSEO_ENV_VARS } from "@repo/dataforseo";
import { GOOGLE_ENV_VARS } from "@repo/search-console";

type Provider = { feature: string; name: string; vars: ReadonlyArray<string> };

const PROVIDERS = {
  dataforseo: {
    feature: "Live keyword rankings, backlinks, and SEO audits",
    name: "DataForSEO",
    vars: DATAFORSEO_ENV_VARS,
  },
  google: {
    feature: "Clicks, impressions, and indexing status",
    name: "Google Search Console",
    vars: GOOGLE_ENV_VARS,
  },
  mail: {
    feature: "Email verification and password recovery",
    name: "Email",
    vars: MAIL_ENV_VARS,
  },
  openai: {
    feature: "AI drafts, rewrites, image prompts, and similar posts",
    name: "OpenAI",
    vars: AI_ENV_VARS,
  },
  r2: {
    feature: "Image uploads and public image delivery",
    name: "Cloudflare R2",
    vars: R2_ENV_VARS,
  },
} satisfies Record<string, Provider>;

type Integration = Omit<Provider, "vars"> & { configured: boolean; missing: Array<string> };

type Integrations = Record<keyof typeof PROVIDERS, Integration>;

export const readIntegrations = (
  env: Record<string, string | undefined> = process.env,
): Integrations => {
  const status = ({ feature, name, vars }: Provider): Integration => {
    const missing = vars.filter((variable) => (env[variable]?.trim() ?? "") === "");

    return { configured: missing.length === 0, feature, missing, name };
  };

  return {
    dataforseo: status(PROVIDERS.dataforseo),
    google: status(PROVIDERS.google),
    mail: status(PROVIDERS.mail),
    openai: status(PROVIDERS.openai),
    r2: status(PROVIDERS.r2),
  };
};
