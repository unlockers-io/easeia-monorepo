import { describe, expect, it, vi } from "vitest";

import { createSignupGuard, isSignupOpen } from "./signup";

describe("signup policy", () => {
  it.each([
    ["open", 0, true],
    ["open", 2, true],
    ["first-user", 0, true],
    ["first-user", 1, false],
    ["closed", 0, false],
    ["closed", 2, false],
  ] as const)("%s with %s users: %s", (mode, count, open) => {
    expect(isSignupOpen(mode, count)).toBe(open);
  });
  it("rejects a second administrator with a readable error", async () => {
    await expect(createSignupGuard("first-user", () => Promise.resolve(1))()).rejects.toThrow(
      "This instance already has an administrator",
    );
  });
  it("does not access the database when signups are closed", async () => {
    const count = vi.fn();
    await expect(createSignupGuard("closed", count)()).rejects.toThrow("Sign-ups are closed");
    expect(count).not.toHaveBeenCalled();
  });
});
