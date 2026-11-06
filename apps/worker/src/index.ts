import "zod/compile";
import "dotenv/config";

import { backfills } from "@repo/backfill";
import { prisma } from "@repo/db";
import { consume, dispatchPendingJobs, schedule, unschedule } from "@repo/jobs/worker";
import { log } from "@repo/observability";
import { initWorkerLogger } from "@repo/observability/worker";

import { registrations } from "./jobs";
import { isRetryable } from "./lib/ai-unavailable";
import { env } from "./lib/env";
import { startMaintenance } from "./lib/maintenance";

initWorkerLogger({ service: "worker" });

const jobs = registrations();

const workers = jobs.map(({ concurrency, handle, kind, onFailure }) =>
  consume({ concurrency, handler: handle, isRetryable, kind, onFailure }),
);

for (const w of workers) {
  w.on("ready", () => {
    log.info({ message: "worker ready", queue: w.name });
  });
  w.on("failed", (job, err) => {
    log.error({
      err,
      errMessage: err.message,
      errName: err.name,
      jobId: job?.id,
      message: "job failed",
      queue: w.name,
    });
  });
  w.on("completed", (job) => {
    log.info({ jobId: job.id, message: "job completed", queue: w.name });
  });
}

log.info({ env: env.NODE_ENV, message: "🚀 Worker started", queues: workers.map((w) => w.name) });

await Promise.all(
  jobs.flatMap(({ kind, tick }) => {
    if (tick === undefined) {
      return [];
    }

    return [tick.enabled ? schedule(kind, tick.everyMs) : unschedule(kind)];
  }),
);

const stopMaintenance = startMaintenance(
  {
    "job dispatch": dispatchPendingJobs,
    ...Object.fromEntries(
      Object.entries(backfills).map(([name, backfill]) => [`${name} backfill`, backfill.tick]),
    ),
  },
  (activity, error) => {
    log.error({ activity, err: error, message: "worker maintenance failed" });
  },
);

const shutdown = async (signal: string) => {
  log.info({ message: "shutting down workers", signal });
  await stopMaintenance();
  await Promise.allSettled(workers.map((w) => w.close()));
  await prisma.$disconnect();
  process.exit(0);
};

let shuttingDown: Promise<void> | undefined;

const requestShutdown = (signal: string): void => {
  shuttingDown ??= shutdown(signal);
  void shuttingDown;
};

process.on("SIGTERM", () => {
  requestShutdown("SIGTERM");
});

process.on("SIGINT", () => {
  requestShutdown("SIGINT");
});
