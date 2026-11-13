import path from "node:path";

import { baseNextConfig } from "@repo/config-next";
import { applyPortlessUrls } from "@repo/portless-env";
import type { NextConfig } from "next";

applyPortlessUrls(["WEB_APP_URL"]);

const nextConfig: NextConfig = {
  ...baseNextConfig("web", {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    instantInsights: { validationLevel: "manual-warning" },
  }),
  // Vercel packages its own functions; standalone output is for self-hosting.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  serverExternalPackages: [
    "@prisma/client",
    "@repo/auto-publish",
    "@repo/backfill",
    "@repo/db",
    "@repo/jobs",
    "@repo/posts",
    "@repo/sites",
  ],
  transpilePackages: ["@repo/ui", "@repo/api-types", "@repo/observability"],
  turbopack: {
    rules: {
      "*.{ts,tsx}": {
        condition: {
          all: [{ not: "foreign" }, { content: /[Zz]od/ }],
        },
        loaders: ["zod-compiler/turbopack"],
      },
    },
  },
};

export default nextConfig;
