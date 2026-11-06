export const MAX_CADENCE_DAYS = 365;
export const MAX_BUCKET_SIZE = 100;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const TICK_EVERY_MS = HOUR_MS;

export type ScheduleIssue = {
  message: string;
  path: "bucketRefillAt" | "bucketTarget" | "cadenceDays";
};

export type Schedule = {
  bucketRefillAt: number | null;
  bucketTarget: number | null;
  cadenceDays: number | null;
};

export type AutoPublishInput = Schedule & { autoPublishEnabled: boolean };

export type NetworkDefaultsInput = Schedule & { overwrite: boolean };

export const countIssue = (
  path: ScheduleIssue["path"],
  value: number | null,
  max: number,
): Array<ScheduleIssue> =>
  value === null || (Number.isInteger(value) && value >= 1 && value <= max)
    ? []
    : [{ message: `Enter a whole number from 1 to ${max}.`, path }];

const scheduleIssues = ({ bucketRefillAt, bucketTarget, cadenceDays }: Schedule) => {
  const counts = [
    ...countIssue("cadenceDays", cadenceDays, MAX_CADENCE_DAYS),
    ...countIssue("bucketTarget", bucketTarget, MAX_BUCKET_SIZE),
    ...countIssue("bucketRefillAt", bucketRefillAt, MAX_BUCKET_SIZE),
  ];

  if ((bucketRefillAt === null) !== (bucketTarget === null)) {
    return [
      ...counts,
      {
        message: "Set both bucket target and refill threshold, or leave both blank.",
        path: bucketRefillAt === null ? "bucketRefillAt" : "bucketTarget",
      } satisfies ScheduleIssue,
    ];
  }

  return counts.length === 0 &&
    bucketRefillAt !== null &&
    bucketTarget !== null &&
    bucketRefillAt > bucketTarget
    ? [
        {
          message: `Refill threshold (${bucketRefillAt}) must be ≤ bucket target (${bucketTarget}).`,
          path: "bucketRefillAt",
        } satisfies ScheduleIssue,
      ]
    : counts;
};

export const configIssues = (input: AutoPublishInput): Array<ScheduleIssue> => [
  ...(input.autoPublishEnabled && input.cadenceDays === null
    ? [
        {
          message: "Cadence is required when auto-publish is enabled.",
          path: "cadenceDays",
        } satisfies ScheduleIssue,
      ]
    : []),
  ...scheduleIssues(input),
];

export const networkDefaultsIssues = (input: Schedule): Array<ScheduleIssue> => [
  ...(input.cadenceDays === null && input.bucketRefillAt === null && input.bucketTarget === null
    ? [
        {
          message: "Fill in at least one section (cadence or bucket).",
          path: "cadenceDays",
        } satisfies ScheduleIssue,
      ]
    : []),
  ...scheduleIssues(input),
];

type Cadence = {
  autoPublishEnabled: boolean;
  cadenceDays: number | null;
  lastAutoPublishedAt: Date | null;
};

export const nextDueAt = ({
  autoPublishEnabled,
  cadenceDays,
  lastAutoPublishedAt,
}: Cadence): Date | null => {
  if (!autoPublishEnabled || cadenceDays === null) {
    return null;
  }

  return lastAutoPublishedAt === null
    ? new Date(0)
    : new Date(lastAutoPublishedAt.getTime() + cadenceDays * DAY_MS);
};

export const isDue = (site: Cadence, now: Date): boolean => {
  const dueAt = nextDueAt(site);

  return dueAt !== null && now.getTime() >= dueAt.getTime();
};
