/// <reference types="node" />

import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { defineConfig, devices } from "@playwright/test";

const getPortlessUrl = (name: string) => {
  if (process.env.CI) {
    return undefined;
  }
  try {
    return execFileSync("portless", ["get", name], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
};

process.env.E2E_RUN_ID ??= randomUUID();

export const webUrl =
  process.env.E2E_WEB_URL ?? getPortlessUrl("easeia.web") ?? "http://127.0.0.1:3000";
export const apiUrl =
  process.env.E2E_API_URL ?? getPortlessUrl("easeia.api") ?? "http://127.0.0.1:4000";

export const landingUrl =
  process.env.E2E_LANDING_URL ?? getPortlessUrl("easeia.landing") ?? "http://127.0.0.1:3001";

export default defineConfig({
  forbidOnly: !!process.env.CI,
  fullyParallel: true,
  globalTeardown: "./tests/e2e/teardown/cleanup.ts",

  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    {
      dependencies: ["setup"],
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "tests/e2e/.auth/user.json",
      },
    },
    ...(process.env.CI
      ? []
      : [
          {
            dependencies: ["setup"],
            name: "firefox",
            use: {
              ...devices["Desktop Firefox"],
              storageState: "tests/e2e/.auth/user.json",
            },
          },
          {
            dependencies: ["setup"],
            name: "webkit",
            use: {
              ...devices["Desktop Safari"],
              storageState: "tests/e2e/.auth/user.json",
            },
          },
        ]),
  ],

  reporter: process.env.CI ? [["html", { open: "never" }]] : [["list"], ["html"]],
  retries: process.env.CI ? 2 : 0,
  testDir: "./tests/e2e",

  use: {
    baseURL: webUrl,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },

  webServer: process.env.CI
    ? [
        {
          command: "node_modules/.bin/next start apps/web --port 3000",
          env: { PGAPPNAME: "easeia:ci:web" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: `${webUrl}/login`,
        },
        {
          command: "NODE_ENV=production node apps/api/dist/index.mjs",
          env: { PGAPPNAME: "easeia:ci:api" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: `${apiUrl}/healthz`,
        },
        {
          command: "node_modules/.bin/next start apps/landing --port 3001",
          env: { PGAPPNAME: "easeia:ci:landing" },
          stderr: "pipe",
          stdout: "pipe",
          timeout: 120_000,
          url: landingUrl,
        },
      ]
    : [],

  workers: process.env.CI ? 1 : undefined,
});
