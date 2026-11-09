import "server-only";

import { DomainError } from "@repo/errors";
import { z } from "zod";

import type { ActionResult } from "./action-result";
import { requireSession } from "./auth-helpers";
import { log } from "./observability";

const firstIssueMessage = (error: z.ZodError): string =>
  error.issues[0]?.message ?? "Check your input.";

const unexpectedFailure = (error: unknown): string => {
  log.error({
    error: error instanceof Error ? error.message : String(error),
    message: "Dashboard action failed",
  });

  return "Could not complete the request. Please try again.";
};

const failureMessage = (error: unknown): string => {
  if (error instanceof DomainError) {
    return error.message;
  }

  return error instanceof z.ZodError ? firstIssueMessage(error) : unexpectedFailure(error);
};

export const settle = async <T>(operation: () => Promise<T>): Promise<ActionResult<T>> => {
  try {
    return { data: await operation(), ok: true };
  } catch (error) {
    return { error: failureMessage(error), ok: false };
  }
};

export const withAuth = async <T>(operation: () => Promise<T>): Promise<ActionResult<T>> => {
  await requireSession();

  return settle(operation);
};
