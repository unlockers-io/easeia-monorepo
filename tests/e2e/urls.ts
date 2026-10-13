import { portlessUrl } from "@repo/portless-env";
import { loopbackUrl } from "@repo/portless-env/apps";
import type { App } from "@repo/portless-env/apps";

const appUrl = (app: App) => (process.env.CI ? loopbackUrl(app, "127.0.0.1") : portlessUrl(app));

export const webUrl = process.env.E2E_WEB_URL ?? appUrl("web");
export const apiUrl = process.env.E2E_API_URL ?? appUrl("api");
export const landingUrl = process.env.E2E_LANDING_URL ?? appUrl("landing");
