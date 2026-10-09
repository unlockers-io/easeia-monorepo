import type { Site } from "@repo/db";

const DAY_MS = 24 * 60 * 60 * 1000;

type Cadence = Pick<Site, "autoPublishEnabled" | "cadenceDays" | "lastAutoPublishedAt">;

export const isDue = (
  { autoPublishEnabled, cadenceDays, lastAutoPublishedAt }: Cadence,
  now: Date,
): boolean =>
  autoPublishEnabled &&
  cadenceDays !== null &&
  (lastAutoPublishedAt === null ||
    now.getTime() - lastAutoPublishedAt.getTime() >= cadenceDays * DAY_MS);
