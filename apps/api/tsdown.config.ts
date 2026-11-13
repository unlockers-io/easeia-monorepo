import path from "node:path";

import { applyPortlessUrls } from "@repo/portless-env";
import alias from "@rollup/plugin-alias";
import { defineConfig } from "tsdown";
import zodCompiler from "zod-compiler/rolldown";

applyPortlessUrls(["CORS_ORIGINS", "WEB_APP_URL"]);

const srcDir = path.resolve(process.cwd(), "src");
const astroContentEntry = path.resolve(process.cwd(), "../../packages/astro-content/src/index.ts");

export default defineConfig({
  clean: true,
  deps: {
    alwaysBundle: [/^@repo\//v, /^@easeia\/astro-content$/v],
  },
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  plugins: [
    zodCompiler({
      // Hono spreads safeParse results; compiled lazy errors are non-enumerable.
      exclude: [
        "**/packages/api-types/**",
        "**/packages/astro-content/**",
        "**/apps/api/src/lib/openapi-schemas.ts",
        "**/apps/api/src/routes/**",
      ],
    }),
    alias({
      entries: [
        { find: "@easeia/astro-content", replacement: astroContentEntry },
        { find: "@", replacement: srcDir },
      ],
    }),
  ],
  sourcemap: true,
  target: "node24",
  tsconfig: "tsconfig.json",
});
