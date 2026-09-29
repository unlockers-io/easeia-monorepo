import type { Prisma } from "@repo/db";
import { DomainError } from "@repo/sites";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";

import { env } from "@/lib/env";

type ErrorPayload = {
  code: string;
  details?: Array<{ field: string; message: string }>;
  message: string;
  stack?: string;
};

const isPrismaKnownError = (
  cause: Error,
): cause is InstanceType<typeof Prisma.PrismaClientKnownRequestError> =>
  "code" in cause && "clientVersion" in cause;

const createErrorHandler =
  (nodeEnv: "development" | "production" | "test") => (err: Error, c: Context) => {
    const forwardedFor = c.req.header("x-forwarded-for");
    c.get("log").error(err, {
      ip:
        forwardedFor !== undefined && forwardedFor !== ""
          ? forwardedFor
          : c.req.header("x-real-ip"),
      method: c.req.method,
      url: c.req.url,
      userAgent: c.req.header("user-agent"),
    });

    if (err instanceof HTTPException) {
      return c.json(
        {
          error: {
            code: "HTTP_EXCEPTION",
            message: err.message,
          },
        },
        err.status,
      );
    }

    if (err instanceof DomainError) {
      const error: ErrorPayload = {
        code: err.code,
        message: err.message,
      };
      if (err.issues) {
        error.details = err.issues.map((issue) => ({
          field: issue.path,
          message: issue.message,
        }));
      }
      return c.json(
        {
          error,
        },
        err.httpStatus,
      );
    }

    if (err instanceof ZodError) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            details: err.issues.map((issue) => ({
              field: issue.path.join("."),
              message: issue.message,
            })),
            message: "Validation failed",
          },
        },
        400 as const,
      );
    }

    if (isPrismaKnownError(err)) {
      if (err.code === "P2002") {
        return c.json(
          {
            error: {
              code: "DUPLICATE_ENTRY",
              message: "A record with this value already exists",
            },
          },
          409 as const,
        );
      }

      if (err.code === "P2025") {
        return c.json(
          {
            error: {
              code: "NOT_FOUND",
              message: "Record not found",
            },
          },
          404 as const,
        );
      }
    }

    const message = nodeEnv === "production" ? "An unexpected error occurred" : err.message;
    const error: ErrorPayload = {
      code: "INTERNAL_SERVER_ERROR",
      message,
    };
    if (nodeEnv !== "production") {
      error.stack = err.stack;
    }

    return c.json(
      {
        error,
      },
      500 as const,
    );
  };

const errorHandler = createErrorHandler(env.NODE_ENV);

export const notFound = (c: Context) => {
  return c.json(
    {
      error: {
        code: "NOT_FOUND",
        message: "Resource not found",
      },
    },
    404 as const,
  );
};

export { createErrorHandler, errorHandler };
