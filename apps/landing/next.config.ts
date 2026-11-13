import { baseNextConfig } from "@repo/config-next";
import { applyPortlessUrls } from "@repo/portless-env";
import type { NextConfig } from "next";

applyPortlessUrls(["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_WEB_APP_URL"]);

const nextConfig: NextConfig = {
  ...baseNextConfig("landing", {
    exposeTestingApiInProductionBuild: process.env.EXPOSE_TESTING_API === "1",
  }),
  transpilePackages: ["@repo/ui", "@repo/observability"],
};

export default nextConfig;
