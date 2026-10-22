import type { Site } from "@repo/db";
import * as Sites from "@repo/sites";
import { DomainError } from "@repo/sites";

const MAX_CADENCE_DAYS = 365;
const MAX_BUCKET_SIZE = 100;

type Issue = { message: string; path: string };

export class AutoPublishConfigError extends DomainError {
  readonly messages: Array<string>;

  constructor(issues: ReadonlyArray<Issue>) {
    const messages = issues.map((issue) => issue.message);
    super(messages.join(" "), "AUTO_PUBLISH_CONFIG", 400, issues);
    this.messages = messages;
    this.name = "AutoPublishConfigError";
  }
}

type BucketInput = { refillAt: number | null; target: number | null };

export type AutoPublishInput = {
  autoPublishEnabled: boolean;
  bucket?: BucketInput;
  cadenceDays: number | null;
};

export type NetworkDefaultsInput = {
  bucket: BucketInput;
  cadenceDays: number | null;
  scope: "overwrite" | "unconfigured";
};

const toCount = (raw: number | null, max: number): number | null =>
  raw === null || Number.isNaN(raw) ? null : Math.max(1, Math.min(max, Math.floor(raw)));

const normalizeBucket = ({ refillAt, target }: BucketInput): BucketInput => ({
  refillAt: toCount(refillAt, MAX_BUCKET_SIZE),
  target: toCount(target, MAX_BUCKET_SIZE),
});

const bucketIssues = ({ refillAt, target }: BucketInput): Array<Issue> => {
  if (refillAt === null && target === null) {
    return [];
  }

  if (refillAt === null || target === null) {
    return [
      {
        message: "Set both bucket target and refill threshold, or leave both blank.",
        path: "bucket",
      },
    ];
  }

  return refillAt > target
    ? [
        {
          message: `Refill threshold (${refillAt}) must be ≤ bucket target (${target}).`,
          path: "bucket.refillAt",
        },
      ]
    : [];
};

const throwIfAny = (issues: ReadonlyArray<Issue>): void => {
  if (issues.length > 0) {
    throw new AutoPublishConfigError(issues);
  }
};

export const configure = async (siteId: string, input: AutoPublishInput): Promise<Site> => {
  const cadenceDays = toCount(input.cadenceDays, MAX_CADENCE_DAYS);
  const bucket = input.bucket === undefined ? undefined : normalizeBucket(input.bucket);
  throwIfAny([
    ...(input.autoPublishEnabled && cadenceDays === null
      ? [{ message: "Cadence is required when auto-publish is enabled.", path: "cadenceDays" }]
      : []),
    ...(bucket === undefined ? [] : bucketIssues(bucket)),
  ]);

  const patch: Sites.SiteUpdatePatch = {
    autoPublishEnabled: input.autoPublishEnabled,
    cadenceDays,
  };

  if (bucket !== undefined) {
    patch.bucketRefillAt = bucket.refillAt;
    patch.bucketTarget = bucket.target;
  }

  return Sites.update(siteId, patch);
};

export const applyNetworkDefaults = async (input: NetworkDefaultsInput) => {
  const cadenceDays = toCount(input.cadenceDays, MAX_CADENCE_DAYS);
  const { refillAt, target } = normalizeBucket(input.bucket);
  throwIfAny([
    ...(cadenceDays === null && refillAt === null && target === null
      ? [{ message: "Fill in at least one section (cadence or bucket).", path: "" }]
      : []),
    ...bucketIssues({ refillAt, target }),
  ]);

  return Sites.applyNetworkDefaults({
    bucket: refillAt === null || target === null ? null : { refillAt, target },
    cadenceDays,
    scope: input.scope,
  });
};
