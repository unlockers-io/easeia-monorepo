// oxlint-disable node/no-sync -- Record cleanup synchronously before a test can create data or fail; email fixture factories are synchronous.
import { randomUUID } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const cleanupDirectory = () => {
  const runId = process.env.E2E_RUN_ID;
  if (runId === undefined || !/^[a-z0-9-]+$/u.test(runId)) {
    throw new Error("Missing E2E run identifier.");
  }
  return join("tests/e2e/.auth/cleanup", runId);
};

export const recordCleanup = (kind: "user" | "site" | "waitlist", value: string): string => {
  const directory = cleanupDirectory();
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, `${randomUUID()}.json`), JSON.stringify({ kind, value }));
  return value;
};
