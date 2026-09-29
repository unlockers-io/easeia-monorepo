import { createHash } from "node:crypto";

import {
  DeleteObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

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

const isMissing = (v: string | undefined): boolean => v === undefined || v === "";

const readConfig = (environment: NodeJS.ProcessEnv = process.env): R2Config => {
  const endpoint = environment.R2_ENDPOINT;
  const accessKeyId = environment.R2_ACCESS_KEY_ID;
  const secretAccessKey = environment.R2_SECRET_ACCESS_KEY;
  const bucket = environment.R2_BUCKET;
  const publicBaseUrl = environment.R2_PUBLIC_BASE_URL;
  if (
    isMissing(endpoint) ||
    isMissing(accessKeyId) ||
    isMissing(secretAccessKey) ||
    isMissing(bucket) ||
    isMissing(publicBaseUrl)
  ) {
    const missing = (
      [
        ["R2_ENDPOINT", endpoint],
        ["R2_ACCESS_KEY_ID", accessKeyId],
        ["R2_SECRET_ACCESS_KEY", secretAccessKey],
        ["R2_BUCKET", bucket],
        ["R2_PUBLIC_BASE_URL", publicBaseUrl],
      ] as const
    ).flatMap(([key, value]) => (isMissing(value) ? [key] : []));
    throw new Error(`@repo/blob: missing R2 env: ${missing.join(", ")}`);
  }
  if (
    endpoint === undefined ||
    accessKeyId === undefined ||
    secretAccessKey === undefined ||
    bucket === undefined ||
    publicBaseUrl === undefined
  ) {
    throw new Error("@repo/blob: unreachable: missing env already reported");
  }
  if (!URL.canParse(publicBaseUrl)) {
    throw new Error(
      `@repo/blob: R2_PUBLIC_BASE_URL is not a parseable absolute URL: ${publicBaseUrl}`,
    );
  }
  return {
    accessKeyId,
    bucket,
    endpoint,
    publicBaseUrl,
    secretAccessKey,
  };
};

type ListObjectsPage = {
  Contents?: Array<{ Key?: string; Size?: number }>;
  IsTruncated?: boolean;
  NextContinuationToken?: string;
};

type BlobBackend = {
  deleteObject: (input: { Bucket: string; Key: string }) => Promise<void>;
  listObjects: (input: {
    Bucket: string;
    ContinuationToken?: string;
    Prefix: string;
  }) => Promise<ListObjectsPage>;
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
    listObjects: (input) => client.send(new ListObjectsV2Command(input)),
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

  const listForSite = async (
    siteId: string,
  ): Promise<Array<{ key: string; size: number; url: string }>> => {
    const { client, config } = getBlobClient();
    const all: Array<{ key: string; size: number; url: string }> = [];
    let continuationToken: string | undefined;
    do {
      const res = await client.listObjects({
        Bucket: config.bucket,
        ContinuationToken: continuationToken,
        Prefix: `sites/${siteId}/`,
      });
      for (const obj of res.Contents ?? []) {
        if (obj.Key === undefined || obj.Key === "") {
          throw new Error(
            `@repo/blob: ListObjectsV2 returned an entry without Key (bucket=${config.bucket}, siteId=${siteId})`,
          );
        }
        all.push({
          key: obj.Key,
          size: obj.Size ?? 0,
          url: publicUrlFor(config, obj.Key),
        });
      }
      continuationToken = res.IsTruncated === true ? res.NextContinuationToken : undefined;
    } while (continuationToken !== undefined && continuationToken !== "");
    return all;
  };

  return { listForSite, remove, upload };
};

const { listForSite, remove, upload } = createBlobStore(getClient);

export { createBlobStore, listForSite, readConfig, remove, upload };
export type { BlobBackend, GetBlobClient, R2Config };
