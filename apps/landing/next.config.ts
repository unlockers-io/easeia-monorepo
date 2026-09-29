import { applyPortlessUrls } from "@repo/portless-env";
import type { NextConfig } from "next";

applyPortlessUrls({ NEXT_PUBLIC_API_URL: ["easeia.api"], NEXT_PUBLIC_WEB_APP_URL: ["easeia.web"] });

const nextConfig: NextConfig = {
  allowedDevOrigins: ["easeia.landing.localhost", "*.easeia.landing.localhost", "*.vercel.app"],
  cacheComponents: true,
  experimental: {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
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
  partialPrefetching: true,
  reactCompiler: true,
  reactStrictMode: true,
  transpilePackages: ["@repo/ui", "@repo/observability"],
};

export default nextConfig;
