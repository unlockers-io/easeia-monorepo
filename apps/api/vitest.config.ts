import nodeConfig from "@repo/config-vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";
import zodCompiler from "zod-compiler/vite";

export default mergeConfig(
  {
    ...nodeConfig,
    plugins: [
      zodCompiler({
        // Hono spreads safeParse results; compiled lazy errors are non-enumerable.
        exclude: [
          "**/packages/api-types/**",
          "**/apps/api/src/lib/openapi-schemas.ts",
          "**/apps/api/src/routes/**",
        ],
      }),
    ],
  },
  defineConfig({
    resolve: {
      alias: {
        "@": new URL("src", import.meta.url).pathname,
      },
    },
    test: {
      setupFiles: ["src/test-env.ts"],
    },
  }),
);
