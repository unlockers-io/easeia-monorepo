import { describe, expect, it } from "vitest";

import { formatDuration, formatRelativeTime } from "./relative-time";

const NOW = new Date("2026-08-15T12:00:00.000Z").getTime();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

describe("formatRelativeTime", () => {
  it("formats past and future instants in the largest whole unit", () => {
    expect(formatRelativeTime(new Date(NOW - 30_000), NOW)).toBe("just now");
    expect(formatRelativeTime(new Date(NOW - 5 * MINUTE), NOW)).toBe("5m ago");
    expect(formatRelativeTime(new Date(NOW + 3 * HOUR), NOW)).toBe("in 3h");
    expect(formatRelativeTime(new Date(NOW - 2 * 24 * HOUR), NOW)).toBe("2d ago");
  });

  it("falls back to a date past thirty days", () => {
    expect(formatRelativeTime(new Date("2026-06-01T00:00:00.000Z"), NOW)).toBe("6/1/2026");
  });
});

describe("formatDuration", () => {
  it("picks minutes, hours or days", () => {
    expect(formatDuration(15 * MINUTE)).toBe("15m");
    expect(formatDuration(HOUR)).toBe("1h");
    expect(formatDuration(48 * HOUR)).toBe("2d");
  });
});
