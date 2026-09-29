import { beforeEach, describe, expect, it } from "vitest";

import { buildBlobKey, createBlobStore, hashBytes, readConfig } from "./index";
import type { BlobBackend, R2Config } from "./index";

describe("buildBlobKey", () => {
  it("derives a deterministic per-site/post key with the original extension", () => {
    const bytes = new Uint8Array([1, 2, 3, 4, 5]);
    const key = buildBlobKey({
      bytes,
      filename: "hero.jpg",
      postId: "post_xyz",
      siteId: "site_abc",
    });
    expect(key).toBe("sites/site_abc/posts/post_xyz/74f81fe167d99b4c.jpg");
  });

  it("lower-cases the extension and strips leading dots", () => {
    const bytes = new Uint8Array([9]);
    const key = buildBlobKey({
      bytes,
      filename: "IMG.PNG",
      postId: "p",
      siteId: "s",
    });
    expect(key.endsWith(".png")).toBe(true);
  });

  it("falls back to .bin when filename has no extension", () => {
    const bytes = new Uint8Array([0]);
    const key = buildBlobKey({
      bytes,
      filename: "no-extension",
      postId: "p",
      siteId: "s",
    });
    expect(key.endsWith(".bin")).toBe(true);
  });
});

describe("hashBytes", () => {
  it("produces a stable 16-char hex prefix", () => {
    const a = hashBytes(new Uint8Array([1, 2, 3]));
    const b = hashBytes(new Uint8Array([1, 2, 3]));
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/v);
  });
});

type ListObjectsPage = Awaited<ReturnType<BlobBackend["listObjects"]>>;
type BackendCall = { input: object; name: keyof BlobBackend };

const listResponses: Array<ListObjectsPage> = [];
const backendCalls: Array<BackendCall> = [];

const backend: BlobBackend = {
  deleteObject: (input) => {
    backendCalls.push({ input, name: "deleteObject" });
    return Promise.resolve();
  },
  listObjects: (input) => {
    backendCalls.push({ input, name: "listObjects" });
    return Promise.resolve(listResponses.shift() ?? { Contents: [], IsTruncated: false });
  },
  putObject: (input) => {
    backendCalls.push({ input, name: "putObject" });
    return Promise.resolve();
  },
};

const config: R2Config = {
  accessKeyId: "test-access-key",
  bucket: "easeia",
  endpoint: "https://acct.r2.cloudflarestorage.com",
  publicBaseUrl: "https://images.example.com/",
  secretAccessKey: "test-secret-key",
};
const validEnvironment: NodeJS.ProcessEnv = {
  R2_ACCESS_KEY_ID: config.accessKeyId,
  R2_BUCKET: config.bucket,
  R2_ENDPOINT: config.endpoint,
  R2_PUBLIC_BASE_URL: config.publicBaseUrl,
  R2_SECRET_ACCESS_KEY: config.secretAccessKey,
};

const blobStore = createBlobStore(() => ({ client: backend, config }));

const R2_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

describe("R2 client operations", () => {
  beforeEach(() => {
    backendCalls.length = 0;
    listResponses.length = 0;
  });

  it("sends a PutObjectCommand to the configured bucket and composes a public URL", async () => {
    const result = await blobStore.upload({
      bytes: new Uint8Array([1, 2, 3, 4, 5]),
      filename: "hero.jpg",
      mime: "image/jpeg",
      postId: "post_xyz",
      siteId: "site_abc",
    });

    expect(backendCalls).toHaveLength(1);
    expect(backendCalls[0]?.name).toBe("putObject");
    expect(backendCalls[0]?.input).toMatchObject({
      Bucket: "easeia",
      ContentType: "image/jpeg",
      Key: "sites/site_abc/posts/post_xyz/74f81fe167d99b4c.jpg",
    });
    expect(result.url).toBe(
      "https://images.example.com/sites/site_abc/posts/post_xyz/74f81fe167d99b4c.jpg",
    );
  });

  it("sends a DeleteObjectCommand for remove(key)", async () => {
    await blobStore.remove("sites/s1/posts/p1/abcd0123.jpg");

    expect(backendCalls).toHaveLength(1);
    expect(backendCalls[0]?.name).toBe("deleteObject");
    expect(backendCalls[0]?.input).toMatchObject({
      Bucket: "easeia",
      Key: "sites/s1/posts/p1/abcd0123.jpg",
    });
  });

  it("paginates listForSite across multiple pages and forwards ContinuationToken", async () => {
    listResponses.push(
      {
        Contents: [
          { Key: "sites/s1/posts/p1/a.jpg", Size: 11 },
          { Key: "sites/s1/posts/p1/b.jpg", Size: 22 },
        ],
        IsTruncated: true,
        NextContinuationToken: "page-2",
      },
      {
        Contents: [{ Key: "sites/s1/posts/p1/c.jpg", Size: 33 }],
        IsTruncated: false,
      },
    );

    const result = await blobStore.listForSite("s1");

    expect(backendCalls).toHaveLength(2);
    expect(backendCalls[0]?.name).toBe("listObjects");
    expect(backendCalls[0]?.input).toMatchObject({
      Bucket: "easeia",
      ContinuationToken: undefined,
      Prefix: "sites/s1/",
    });
    expect(backendCalls[1]?.input).toMatchObject({ ContinuationToken: "page-2" });
    expect(result).toEqual([
      {
        key: "sites/s1/posts/p1/a.jpg",
        size: 11,
        url: "https://images.example.com/sites/s1/posts/p1/a.jpg",
      },
      {
        key: "sites/s1/posts/p1/b.jpg",
        size: 22,
        url: "https://images.example.com/sites/s1/posts/p1/b.jpg",
      },
      {
        key: "sites/s1/posts/p1/c.jpg",
        size: 33,
        url: "https://images.example.com/sites/s1/posts/p1/c.jpg",
      },
    ]);
  });

  it("throws when ListObjectsV2 returns an entry without Key", async () => {
    listResponses.push({
      Contents: [{ Size: 99 }],
      IsTruncated: false,
    });

    await expect(blobStore.listForSite("s1")).rejects.toThrow(/without Key/v);
  });

  it.each(R2_ENV_VARS)("names %s when only that var is missing", (missingVar) => {
    const environment: NodeJS.ProcessEnv = { ...validEnvironment };
    Reflect.deleteProperty(environment, missingVar);
    expect(() => readConfig(environment)).toThrow(new RegExp(`missing R2 env: ${missingVar}`, "v"));
  });

  it("rejects R2_PUBLIC_BASE_URL that isn't a parseable absolute URL", () => {
    expect(() =>
      readConfig({ ...validEnvironment, R2_PUBLIC_BASE_URL: "images.example.com" }),
    ).toThrow(/not a parseable absolute URL/v);
  });
});
