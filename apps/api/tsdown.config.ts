import path from "node:path";

import { applyPortlessUrls } from "@repo/portless-env";
import alias from "@rollup/plugin-alias";
import { defineConfig } from "tsdown";
import zodCompiler from "zod-compiler/rolldown";

applyPortlessUrls({
  CORS_ORIGINS: ["easeia.web", "easeia.landing"],
  WEB_APP_URL: ["easeia.web"],
});

const srcDir = path.resolve(process.cwd(), "src");

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/^@repo\//v],
    neverBundle: ["bullmq", "ioredis"],
  },
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  plugins: [
    zodCompiler({
      // Hono spreads safeParse results; compiled lazy errors are non-enumerable.
      exclude: [
        "**/packages/api-types/**",
        "**/apps/api/src/lib/openapi-schemas.ts",
        "**/apps/api/src/routes/**",
      ],
    }),
    alias({
      entries: [{ find: "@", replacement: srcDir }],
    }),
  ],
  sourcemap: true,
  target: "node22",
  tsconfig: "tsconfig.json",
});
