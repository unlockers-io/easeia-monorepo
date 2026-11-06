import { createHash } from "node:crypto";

import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type BuildBlobKeyInput = {
  bytes: Uint8Array;
  filename: string;
  postId: string;
  siteId: string;
};

export const hashBytes = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex").slice(0, 16);

const extensionOf = (filename: string): string => {
  const idx = filename.lastIndexOf(".");

  if (idx <= 0 || idx === filename.length - 1) {
    return "bin";
  }

  return filename.slice(idx + 1).toLowerCase();
};

const MIME_BY_EXTENSION = new Map([
  ["gif", "image/gif"],
  ["png", "image/png"],
  ["webp", "image/webp"],
]);

export const mimeFor = (filename: string): string =>
  MIME_BY_EXTENSION.get(extensionOf(filename)) ?? "image/jpeg";

export const buildBlobKey = (input: BuildBlobKeyInput): string => {
  const hash = hashBytes(input.bytes);
  const ext = extensionOf(input.filename);

  return `sites/${input.siteId}/posts/${input.postId}/${hash}.${ext}`;
};

export type UploadInput = BuildBlobKeyInput & {
  mime: string;
};

export type UploadResult = {
  key: string;
  url: string;
};

type R2Config = {
  accessKeyId: string;
  bucket: string;
  endpoint: string;
  publicBaseUrl: string;
  secretAccessKey: string;
};

export const R2_ENV_VARS = [
  "R2_ENDPOINT",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
] as const;

const readConfig = (environment: NodeJS.ProcessEnv = process.env): R2Config => {
  const missing = R2_ENV_VARS.filter((name) => (environment[name] ?? "") === "");

  if (missing.length > 0) {
    throw new Error(`@repo/blob: missing R2 env: ${missing.join(", ")}`);
  }

  const value = (name: (typeof R2_ENV_VARS)[number]): string => environment[name] ?? "";
  const publicBaseUrl = value("R2_PUBLIC_BASE_URL");

  if (!URL.canParse(publicBaseUrl)) {
    throw new Error(
      `@repo/blob: R2_PUBLIC_BASE_URL is not a parseable absolute URL: ${publicBaseUrl}`,
    );
  }

  return {
    accessKeyId: value("R2_ACCESS_KEY_ID"),
    bucket: value("R2_BUCKET"),
    endpoint: value("R2_ENDPOINT"),
    publicBaseUrl,
    secretAccessKey: value("R2_SECRET_ACCESS_KEY"),
  };
};

export const isBlobUrl = (url: string, environment: NodeJS.ProcessEnv = process.env): boolean => {
  const base = environment.R2_PUBLIC_BASE_URL ?? "";

  return base !== "" && url.startsWith(base);
};

type BlobBackend = {
  deleteObject: (input: { Bucket: string; Key: string }) => Promise<void>;
  putObject: (input: {
    Body: Uint8Array;
    Bucket: string;
    ContentType: string;
    Key: string;
  }) => Promise<void>;
};

type BlobClient = { client: BlobBackend; config: R2Config };

type GetBlobClient = () => BlobClient;

let cachedClient: BlobClient | null = null;

const getClient = (): BlobClient => {
  if (cachedClient) {
    return cachedClient;
  }

  const config = readConfig();

  const client = new S3Client({
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    endpoint: config.endpoint,
    region: "auto",
  });

  const backend: BlobBackend = {
    deleteObject: async (input) => {
      await client.send(new DeleteObjectCommand(input));
    },
    putObject: async (input) => {
      await client.send(new PutObjectCommand(input));
    },
  };

  cachedClient = { client: backend, config };

  return cachedClient;
};

export const blobPublicUrl = (baseUrl: string, key: string): string =>
  `${baseUrl.replace(/\/+$/v, "")}/${key}`;

const publicUrlFor = (config: R2Config, key: string): string =>
  blobPublicUrl(config.publicBaseUrl, key);

const createBlobStore = (getBlobClient: GetBlobClient) => {
  const upload = async (input: UploadInput): Promise<UploadResult> => {
    const key = buildBlobKey(input);
    const { client, config } = getBlobClient();
    await client.putObject({
      Body: input.bytes,
      Bucket: config.bucket,
      ContentType: input.mime,
      Key: key,
    });

    return { key, url: publicUrlFor(config, key) };
  };

  const remove = async (key: string): Promise<void> => {
    const { client, config } = getBlobClient();
    await client.deleteObject({ Bucket: config.bucket, Key: key });
  };

  return { remove, upload };
};

const { remove, upload } = createBlobStore(getClient);

export { createBlobStore, readConfig, remove, upload };

export type { BlobBackend, GetBlobClient, R2Config };
