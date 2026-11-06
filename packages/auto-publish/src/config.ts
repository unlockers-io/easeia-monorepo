import { prisma, type Site } from "@repo/db";
import { DomainError } from "@repo/errors";
import * as Sites from "@repo/sites";

import {
  configIssues,
  countIssue,
  MAX_CADENCE_DAYS,
  networkDefaultsIssues,
  type AutoPublishInput,
  type NetworkDefaultsInput,
  type ScheduleIssue,
} from "./rules";

export class AutoPublishConfigError extends DomainError {
  constructor(issues: ReadonlyArray<ScheduleIssue>) {
    super(issues.map((issue) => issue.message).join(" "), "AUTO_PUBLISH_CONFIG", 400, issues);
    this.name = "AutoPublishConfigError";
  }
}

const throwIfAny = (issues: ReadonlyArray<ScheduleIssue>): void => {
  if (issues.length > 0) {
    throw new AutoPublishConfigError(issues);
  }
};

export const configure = async (
  siteId: string,
  { autoPublishEnabled, bucketRefillAt, bucketTarget, cadenceDays }: AutoPublishInput,
): Promise<Site> => {
  const schedule = { autoPublishEnabled, bucketRefillAt, bucketTarget, cadenceDays };
  throwIfAny(configIssues(schedule));
  await Sites.load(siteId);

  return Sites.updateSchedule(siteId, schedule);
};

export const setCadence = (siteId: string, cadenceDays: number | null): Promise<Site> => {
  throwIfAny(countIssue("cadenceDays", cadenceDays, MAX_CADENCE_DAYS));

  return Sites.updateSchedule(siteId, { autoPublishEnabled: cadenceDays !== null, cadenceDays });
};

export const applyNetworkDefaults = async ({ overwrite, ...schedule }: NetworkDefaultsInput) => {
  throwIfAny(networkDefaultsIssues(schedule));
  const { bucketRefillAt, bucketTarget, cadenceDays } = schedule;

  return prisma.$transaction(async (tx) => ({
    bucketSitesUpdated:
      bucketRefillAt === null || bucketTarget === null
        ? 0
        : await Sites.updateEnabledSchedules(
            { bucketRefillAt, bucketTarget },
            overwrite ? {} : { bucketRefillAt: null, bucketTarget: null },
            tx,
          ),
    cadenceSitesUpdated:
      cadenceDays === null
        ? 0
        : await Sites.updateEnabledSchedules(
            { autoPublishEnabled: true, cadenceDays },
            overwrite ? {} : { cadenceDays: null },
            tx,
          ),
  }));
};
