import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { apps, canonicalHostname, canonicalUrl, canonicalUrls, loopbackUrl, urlEnv } from "./apps";

const appIds = ["api", "landing", "web"] as const;

const repoFile = (path: string) => readFile(new URL(`../../../${path}`, import.meta.url), "utf8");

describe("registry", () => {
  it("derives each app's canonical URL from its portless name", () => {
    expect(appIds.map(canonicalUrl)).toEqual([
      "https://easeia.api.localhost",
      "https://easeia.landing.localhost",
      "https://easeia.web.localhost",
    ]);
  });

  it("derives URL env defaults from the apps that fill them", () => {
    expect(canonicalUrls("CORS_ORIGINS")).toEqual([canonicalUrl("web"), canonicalUrl("landing")]);
    expect(canonicalUrls("NEXT_PUBLIC_API_URL")).toEqual([canonicalUrl("api")]);
    expect(canonicalUrls("WEB_APP_URL")).toEqual([canonicalUrl("web")]);
  });

  it("lists every app", () => {
    expect(Object.keys(apps)).toEqual(appIds);
  });

  it("serves each app on its own loopback port", () => {
    expect(loopbackUrl("api", "localhost")).toBe("http://localhost:4000");
    expect(new Set(appIds.map((app) => apps[app].port)).size).toBe(appIds.length);
  });
});

describe("literals that cannot import the registry", () => {
  it.each(appIds)("runs the %s dev script under its portless name", async (app) => {
    const { scripts } = JSON.parse(await repoFile(`apps/${app}/package.json`));
    expect(scripts.dev).toMatch(new RegExp(`^portless run --name ${apps[app].name} `));
  });

  it.each(["landing", "web"] as const)(
    "runs the %s plain dev script on its loopback port",
    async (app) => {
      const { scripts } = JSON.parse(await repoFile(`apps/${app}/package.json`));
      expect(scripts["dev:plain"]).toMatch(new RegExp(`--port ${apps[app].port}$`));
    },
  );

  it.each(["landing", "web"] as const)(
    "allows the %s dev origins in next.config.ts",
    async (app) => {
      const config = await repoFile(`apps/${app}/next.config.ts`);
      expect(config).toContain(`"${canonicalHostname(app)}", "*.${canonicalHostname(app)}"`);
    },
  );

  it.each(["CORS_ORIGINS", "NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WEB_APP_URL"] as const)(
    "points CI's %s at the loopback URLs of the apps that fill it",
    async (envKey) => {
      const workflow = await repoFile(".github/workflows/e2e.yml");
      const urls = urlEnv[envKey].map((app) => loopbackUrl(app, "127.0.0.1")).join(",");
      expect(workflow).toContain(`${envKey}: ${urls}\n`);
    },
  );
});
