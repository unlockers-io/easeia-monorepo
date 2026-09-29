import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { z } from "zod";

import { buildImageSchema, buildManifestSchema } from "./types";
import type { EaseiaClientConfig } from "./types";

export type PrefetchInput = EaseiaClientConfig & {
  outDir: string;
};

export type PrefetchResult =
  | { contentHash: string; downloaded: number; status: "downloaded" }
  | { contentHash: string; status: "up-to-date" };

const CACHE_FILE = ".content-hash";

const readCachedHash = async (outDir: string): Promise<string | null> => {
  try {
    const content = await readFile(join(outDir, CACHE_FILE), "utf8");
    return content.trim();
  } catch {
    return null;
  }
};

const fetchJson = async <Output>(
  url: string,
  apiKey: string,
  schema: z.ZodType<Output>,
  invalidPayloadMessage: string,
): Promise<Output> => {
  const res = await fetch(url, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    throw new Error(`Easeia build API ${res.status} for ${url}: ${await res.text()}`);
  }
  const json: unknown = await res.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new Error(invalidPayloadMessage);
  }
  return parsed.data;
};

const imagesPayloadSchema = z.looseObject({
  data: z.array(buildImageSchema),
});

export const prefetchImages = async (input: PrefetchInput): Promise<PrefetchResult> => {
  const base = `${input.apiUrl}/api/build/sites/${input.siteId}`;
  await mkdir(input.outDir, { recursive: true });

  const [manifestResult, cachedHashResult] = await Promise.allSettled([
    fetchJson(
      `${base}/manifest`,
      input.apiKey,
      buildManifestSchema,
      "Easeia build API returned an unexpected manifest shape",
    ),
    readCachedHash(input.outDir),
  ]);
  if (manifestResult.status === "rejected") {
    throw manifestResult.reason;
  }
  if (cachedHashResult.status === "rejected") {
    throw cachedHashResult.reason;
  }
  const manifest = manifestResult.value;
  const cachedHash = cachedHashResult.value;
  if (cachedHash === manifest.contentHash) {
    return { contentHash: manifest.contentHash, status: "up-to-date" };
  }

  const { data: images } = await fetchJson(
    `${base}/images`,
    input.apiKey,
    imagesPayloadSchema,
    "Easeia build API returned an unexpected images payload",
  );

  let downloaded = 0;
  for (const image of images) {
    const res = await fetch(image.url);
    if (!res.ok) {
      throw new Error(`failed to fetch ${image.url}: ${res.status}`);
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    await writeFile(join(input.outDir, image.filename), bytes);
    downloaded += 1;
  }

  await writeFile(join(input.outDir, CACHE_FILE), manifest.contentHash);
  return { contentHash: manifest.contentHash, downloaded, status: "downloaded" };
};
