import { env } from "./env";

export const buildRedirectUri = (): string | null =>
  env.APP_URL === undefined ? null : `${env.APP_URL.replace(/\/$/v, "")}/api/google/callback`;
