import { defineConfig } from "vitest/config";
import zodCompiler from "zod-compiler/vite";

const nodeConfig = defineConfig({
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
  test: {
    environment: "node",
    fileParallelism: process.env.TEST_DATABASE !== "true",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    passWithNoTests: true,
  },
});

export default nodeConfig;
