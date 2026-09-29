import { PostNotFoundError, PostValidationError } from "@repo/posts";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.hoisted(() => {
  Object.assign(process.env, {
    BETTER_AUTH_SECRET: "test-secret-that-is-at-least-32-characters",
    DATABASE_URL: "postgresql://test:test@localhost:5440/easeia_test",
    FROM_EMAIL: "test@easeia.com",
    REDIS_URL: "redis://localhost:6381",
    WP_ENCRYPTION_KEY: "test-encryption-key",
  });
});

import { createErrorHandler, notFound } from "./error-handler";

const errorHandler = createErrorHandler("development");

const mockLogger = {
  debug: vi.fn(),
  emit: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  set: vi.fn(),
  warn: vi.fn(),
};

type JsonResponseBody = {
  error: {
    code: string;
    details?: Array<{ field: string; message: string }>;
    message: string;
    stack?: string;
  };
};

const createMockContext = (headers: Record<string, string> = {}) => {
  return {
    get: vi.fn((key: string) => (key === "log" ? mockLogger : undefined)),
    json: vi.fn((body: JsonResponseBody, status?: number) => ({ body, status })),
    req: {
      header: vi.fn((name: string) => headers[name]),
      method: "GET",
      url: "http://localhost/test",
    },
  } as unknown as Context & { json: ReturnType<typeof vi.fn> };
};

describe("errorHandler", () => {
  it("should handle HTTPException", () => {
    const c = createMockContext();
    const err = new HTTPException(403, { message: "Forbidden" });

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "HTTP_EXCEPTION", message: "Forbidden" } },
      403,
    );
  });

  it("should handle ZodError with field details", () => {
    const c = createMockContext();
    const err = new ZodError([
      {
        code: "too_small",
        inclusive: true,
        message: "Required",
        minimum: 1,
        origin: "string",
        path: ["name"],
      },
    ]);

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      {
        error: {
          code: "VALIDATION_ERROR",
          details: [{ field: "name", message: "Required" }],
          message: "Validation failed",
        },
      },
      400,
    );
  });

  it("should handle a domain error carrying httpStatus + code", () => {
    const c = createMockContext();
    const err = new PostNotFoundError("cknone");

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "POST_NOT_FOUND", message: "Post not found: cknone" } },
      404,
    );
  });

  it("should include details when a domain error carries issues", () => {
    const c = createMockContext();
    const err = new PostValidationError([{ message: "must be present", path: "title" }]);

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      {
        error: {
          code: "POST_VALIDATION_ERROR",
          details: [{ field: "title", message: "must be present" }],
          message: "Validation failed: title: must be present",
        },
      },
      400,
    );
  });

  it("should handle P2002 as 409 DUPLICATE_ENTRY", () => {
    const c = createMockContext();
    const err = Object.assign(new Error("Unique constraint failed"), {
      clientVersion: "7.0.0",
      code: "P2002",
    });

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "DUPLICATE_ENTRY", message: "A record with this value already exists" } },
      409,
    );
  });

  it("should handle P2025 as 404 NOT_FOUND", () => {
    const c = createMockContext();
    const err = Object.assign(new Error("Record not found"), {
      clientVersion: "7.0.0",
      code: "P2025",
    });

    errorHandler(err, c);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "NOT_FOUND", message: "Record not found" } },
      404,
    );
  });

  it("should include error message and stack in development", () => {
    const c = createMockContext();
    const err = new Error("dev error");

    errorHandler(err, c);

    const call = c.json.mock.calls[0];
    expect(call?.[0]?.error?.message).toBe("dev error");
    expect(call?.[0]?.error?.stack).toBeDefined();
    expect(call?.[1]).toBe(500);
  });

  it("should hide error message in production", () => {
    const c = createMockContext();
    const err = new Error("secret detail");

    createErrorHandler("production")(err, c);

    const call = c.json.mock.calls[0];
    expect(call?.[0]?.error?.message).toBe("An unexpected error occurred");
    expect(call?.[0]?.error?.stack).toBeUndefined();
  });
});

describe("notFound", () => {
  it("should return 404 with NOT_FOUND code", () => {
    const c = createMockContext();

    notFound(c);

    expect(c.json).toHaveBeenCalledWith(
      { error: { code: "NOT_FOUND", message: "Resource not found" } },
      404,
    );
  });
});
