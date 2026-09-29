#!/usr/bin/env node
import { prefetchImages } from "../prefetch-images";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

const run = async () => {
  const result = await prefetchImages({
    apiKey: requireEnv("EASEIA_API_KEY"),
    apiUrl: requireEnv("EASEIA_API_URL"),
    outDir: process.env.EASEIA_IMAGES_DIR ?? "src/content/posts/images",
    siteId: requireEnv("EASEIA_SITE_ID"),
  });
  console.log(
    result.status === "up-to-date"
      ? `[easeia-prefetch-images] up to date (contentHash ${result.contentHash})`
      : `[easeia-prefetch-images] downloaded=${result.downloaded} (contentHash ${result.contentHash})`,
  );
};

try {
  await run();
} catch (error) {
  console.error(error);
  process.exit(1);
}
