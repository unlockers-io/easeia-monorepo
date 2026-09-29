import { defineConfig } from "tsdown";

export default defineConfig({
  clean: true,
  deps: { neverBundle: ["astro"] },
  dts: true,
  entry: ["src/index.ts", "src/bin/prefetch.ts"],
  format: "esm",
  platform: "neutral",
  sourcemap: true,
  target: "es2022",
  treeshake: true,
  tsconfig: "tsconfig.json",
});
