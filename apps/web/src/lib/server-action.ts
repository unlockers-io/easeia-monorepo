import "server-only";

import { AiNotConfiguredError } from "@repo/ai";
import { Prisma } from "@repo/db";
import { DomainError } from "@repo/sites";
import { z } from "zod";

import type { ActionResult } from "./action-result";
import { requireSession } from "./auth-helpers";
import { log } from "./observability";

export const withAuth = async <T>(operation: () => Promise<T>): Promise<ActionResult<T>> => {
  await requireSession();
  try {
    return { data: await operation(), ok: true };
  } catch (error) {
    if (error instanceof DomainError || error instanceof AiNotConfiguredError) {
      return { error: error.message, ok: false };
    }
    if (error instanceof z.ZodError) {
      return { error: error.issues[0]?.message ?? "Check your input.", ok: false };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "This domain is already registered.", ok: false };
    }
    log.error({
      error: error instanceof Error ? error.message : String(error),
      message: "Dashboard action failed",
    });
    return { error: "Could not complete the request. Please try again.", ok: false };
  }
};
