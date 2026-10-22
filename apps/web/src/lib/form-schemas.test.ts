import { describe, expect, it } from "vitest";

import {
  autoPublishSchema,
  loginSchema,
  networkDefaultsSchema,
  recoverSchema,
  registerSchema,
  resetPasswordSchema,
} from "./form-schemas";

describe("loginSchema", () => {
  it("should accept valid credentials", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "securepassword",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "securepassword",
    });
    expect(result.success).toBe(false);
  });

  it("should reject empty email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "securepassword",
    });
    expect(result.success).toBe(false);
  });

  it("should reject password shorter than 12 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("should accept password with exactly 12 characters", () => {
    const result = loginSchema.safeParse({
      email: "user@example.com",
      password: "123456789012",
    });
    expect(result.success).toBe(true);
  });
});

describe("registerSchema", () => {
  const validData = {
    confirmPassword: "securepassword",
    email: "user@example.com",
    name: "John Doe",
    password: "securepassword",
  };

  it("should accept valid registration data", () => {
    const result = registerSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("should reject name shorter than 3 characters", () => {
    const result = registerSchema.safeParse({ ...validData, name: "AB" });
    expect(result.success).toBe(false);
  });

  it("should reject name longer than 32 characters", () => {
    const result = registerSchema.safeParse({ ...validData, name: "A".repeat(33) });
    expect(result.success).toBe(false);
  });

  it("should accept name with exactly 3 characters", () => {
    const result = registerSchema.safeParse({ ...validData, name: "ABC" });
    expect(result.success).toBe(true);
  });

  it("should accept name with exactly 32 characters", () => {
    const result = registerSchema.safeParse({ ...validData, name: "A".repeat(32) });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = registerSchema.safeParse({ ...validData, email: "bad" });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = registerSchema.safeParse({ ...validData, password: "short" });
    expect(result.success).toBe(false);
  });

  it("should reject short confirm password", () => {
    const result = registerSchema.safeParse({ ...validData, confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("should reject mismatched passwords on the confirmation field", () => {
    const result = registerSchema.safeParse({ ...validData, confirmPassword: "securepasswore" });
    expect(result.error?.issues).toMatchObject([
      { message: "Passwords do not match", path: ["confirmPassword"] },
    ]);
  });
});

describe("recoverSchema", () => {
  it("should accept valid email", () => {
    const result = recoverSchema.safeParse({ email: "user@example.com" });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = recoverSchema.safeParse({ email: "not-email" });
    expect(result.success).toBe(false);
  });

  it("should reject empty email", () => {
    const result = recoverSchema.safeParse({ email: "" });
    expect(result.success).toBe(false);
  });

  it("should reject missing email", () => {
    const result = recoverSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("should accept valid passwords", () => {
    const result = resetPasswordSchema.safeParse({
      confirmPassword: "newpassword12",
      password: "newpassword12",
    });
    expect(result.success).toBe(true);
  });

  it("should reject short password", () => {
    const result = resetPasswordSchema.safeParse({
      confirmPassword: "newpassword12",
      password: "short",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short confirmPassword", () => {
    const result = resetPasswordSchema.safeParse({
      confirmPassword: "short",
      password: "newpassword12",
    });
    expect(result.success).toBe(false);
  });

  it("should accept passwords with exactly 12 characters", () => {
    const result = resetPasswordSchema.safeParse({
      confirmPassword: "123456789012",
      password: "123456789012",
    });
    expect(result.success).toBe(true);
  });

  it("should reject mismatched passwords on the confirmation field", () => {
    const result = resetPasswordSchema.safeParse({
      confirmPassword: "newpassword13",
      password: "newpassword12",
    });
    expect(result.error?.issues).toMatchObject([
      { message: "Passwords do not match", path: ["confirmPassword"] },
    ]);
  });
});

const issuesOf = (result: {
  error?: { issues: Array<{ message: string; path: Array<PropertyKey> }> };
}) => result.error?.issues.map(({ message, path }) => ({ message, path })) ?? [];

describe("autoPublishSchema", () => {
  const valid = {
    bucketRefillAt: "3",
    bucketTarget: "10",
    cadenceDays: "7",
    enabled: true,
    language: "PT" as const,
    topicHints: "",
  };

  it("should accept a cadence with a bucket, and both bucket fields blank", () => {
    expect(autoPublishSchema.safeParse(valid).success).toBe(true);
    expect(
      autoPublishSchema.safeParse({ ...valid, bucketRefillAt: "", bucketTarget: "" }).success,
    ).toBe(true);
  });

  it("should require a cadence only while auto-publish is enabled", () => {
    expect(issuesOf(autoPublishSchema.safeParse({ ...valid, cadenceDays: "" }))).toEqual([
      { message: "Cadence is required when auto-publish is enabled.", path: ["cadenceDays"] },
    ]);
    expect(autoPublishSchema.safeParse({ ...valid, cadenceDays: "", enabled: false }).success).toBe(
      true,
    );
  });

  it("should reject counts outside their range or with decimals", () => {
    expect(issuesOf(autoPublishSchema.safeParse({ ...valid, cadenceDays: "366" }))).toEqual([
      { message: "Enter a whole number from 1 to 365.", path: ["cadenceDays"] },
    ]);
    expect(issuesOf(autoPublishSchema.safeParse({ ...valid, bucketTarget: "1.5" }))).toEqual([
      { message: "Enter a whole number from 1 to 100.", path: ["bucketTarget"] },
    ]);
  });

  it("should put a half-filled bucket on the blank field", () => {
    expect(issuesOf(autoPublishSchema.safeParse({ ...valid, bucketRefillAt: "" }))).toEqual([
      {
        message: "Set both bucket target and refill threshold, or leave both blank.",
        path: ["bucketRefillAt"],
      },
    ]);
  });

  it("should put a refill threshold above the target on the refill field", () => {
    expect(
      issuesOf(autoPublishSchema.safeParse({ ...valid, bucketRefillAt: "12", bucketTarget: "10" })),
    ).toEqual([
      { message: "Refill threshold (12) must be ≤ bucket target (10).", path: ["bucketRefillAt"] },
    ]);
  });
});

describe("networkDefaultsSchema", () => {
  const blank = { bucketRefillAt: "", bucketTarget: "", cadenceDays: "", overwrite: false };

  it("should accept either section on its own", () => {
    expect(networkDefaultsSchema.safeParse({ ...blank, cadenceDays: "7" }).success).toBe(true);
    expect(
      networkDefaultsSchema.safeParse({ ...blank, bucketRefillAt: "3", bucketTarget: "10" })
        .success,
    ).toBe(true);
  });

  it("should ask for at least one section on the cadence field", () => {
    expect(issuesOf(networkDefaultsSchema.safeParse(blank))).toEqual([
      { message: "Fill in at least one section (cadence or bucket).", path: ["cadenceDays"] },
    ]);
  });

  it("should put a half-filled bucket on the blank field", () => {
    expect(issuesOf(networkDefaultsSchema.safeParse({ ...blank, bucketRefillAt: "3" }))).toEqual([
      {
        message: "Set both bucket target and refill threshold, or leave both blank.",
        path: ["bucketTarget"],
      },
    ]);
  });
});
