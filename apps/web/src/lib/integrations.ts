const PROVIDERS = {
  dataforseo: ["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"],
  google: ["GOOGLE_OAUTH_CLIENT_ID", "GOOGLE_OAUTH_CLIENT_SECRET"],
  mail: ["RESEND_API_KEY", "FROM_EMAIL"],
  openai: ["OPENAI_API_KEY"],
  r2: [
    "R2_ENDPOINT",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
    "R2_PUBLIC_BASE_URL",
  ],
} as const;

type IntegrationStatus = { configured: boolean; missing: Array<string> };
type Integrations = Record<keyof typeof PROVIDERS, IntegrationStatus>;

export const readIntegrations = (
  env: Record<string, string | undefined> = process.env,
): Integrations => {
  const status = (keys: ReadonlyArray<string>): IntegrationStatus => {
    const missing = keys.filter((key) => (env[key]?.trim() ?? "") === "");
    return { configured: missing.length === 0, missing };
  };
  return {
    dataforseo: status(PROVIDERS.dataforseo),
    google: status(PROVIDERS.google),
    mail: status(PROVIDERS.mail),
    openai: status(PROVIDERS.openai),
    r2: status(PROVIDERS.r2),
  };
};
