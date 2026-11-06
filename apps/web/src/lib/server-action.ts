import "server-only";

import { DomainError } from "@repo/errors";
import { z } from "zod";

import type { ActionResult } from "./action-result";
import { requireSession } from "./auth-helpers";
import { log } from "./observability";

export const settle = async <T>(operation: () => Promise<T>): Promise<ActionResult<T>> => {
  try {
    return { data: await operation(), ok: true };
  } catch (error) {
    if (error instanceof DomainError) {
      return { error: error.message, ok: false };
    }

    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Check your input.", ok: false };
    }

    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "Dashboard action failed",
    });

    return { error: "Could not complete the request. Please try again.", ok: false };
  }
};

export const withAuth = async <T>(operation: () => Promise<T>): Promise<ActionResult<T>> => {
  await requireSession();

  return settle(operation);
};
