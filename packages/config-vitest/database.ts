import nodeConfig from "@repo/config-vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";

const databaseConfig = mergeConfig(
  nodeConfig,
  defineConfig({
    test: { fileParallelism: process.env.TEST_DATABASE !== "true" },
  }),
);

export default databaseConfig;
