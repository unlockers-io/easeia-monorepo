import { defineConfig } from "vitest/config";
import zodCompiler from "zod-compiler/vite";

export const createNodeConfig = (zodCompilerOptions?: Parameters<typeof zodCompiler>[0]) =>
  defineConfig({
    plugins: [zodCompiler(zodCompilerOptions)],
    test: {
      environment: "node",
      fileParallelism: process.env.TEST_DATABASE !== "true",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      passWithNoTests: true,
    },
  });

const nodeConfig = createNodeConfig();

export default nodeConfig;
