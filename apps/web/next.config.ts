import path from "node:path";

import { applyPortlessUrls } from "@repo/portless-env";
import type { NextConfig } from "next";

applyPortlessUrls({
  WEB_APP_URL: ["easeia.web"],
});

const nextConfig: NextConfig = {
  allowedDevOrigins: ["easeia.web.localhost", "*.easeia.web.localhost", "*.vercel.app"],
  cacheComponents: true,
  experimental: {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
    instantInsights: { validationLevel: "manual-warning" },
    turbopackRustReactCompiler: true,
  },
  headers: () =>
    Promise.resolve([
      {
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
        source: "/:path*",
      },
    ]),
  // Vercel packages its own functions; standalone output is for self-hosting.
  output: process.env.VERCEL === "1" ? undefined : "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  partialPrefetching: true,
  reactCompiler: true,
  reactStrictMode: true,
  redirects: () =>
    Promise.resolve([
      {
        destination: "/dashboard/money-sites/:path*",
        permanent: true,
        source: "/money-sites/:path*",
      },
      { destination: "/dashboard/network/:path*", permanent: true, source: "/network/:path*" },
    ]),
  serverExternalPackages: [
    "@prisma/client",
    "@repo/db",
    "@repo/jobs",
    "@repo/posts",
    "@repo/sites",
    "bullmq",
    "ioredis",
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
