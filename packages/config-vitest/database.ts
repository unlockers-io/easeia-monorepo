import nodeConfig from "@repo/config-vitest/node";
import { defineConfig, mergeConfig } from "vitest/config";

const databaseConfig = mergeConfig(
  nodeConfig,
  defineConfig({
    test: {
      env: {
        DATABASE_URL:
          process.env.DATABASE_URL ?? "postgresql://test:test@localhost:5440/easeia_test",
      },
      fileParallelism: process.env.TEST_DATABASE !== "true",
    },
  }),
);

export default databaseConfig;
