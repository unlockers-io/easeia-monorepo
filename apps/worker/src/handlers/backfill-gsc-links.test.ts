import { describe, expect, it } from "vitest";

import { sliceBatch } from "./slice-batch";

describe("sliceBatch", () => {
  const ids = Array.from({ length: 12 }, (_, i) => `p${i}`);

  it("returns the first batch and advances cursor", () => {
    const { next, slice } = sliceBatch(ids, 0, 5);
    expect(slice).toEqual(["p0", "p1", "p2", "p3", "p4"]);
    expect(next).toBe(5);
  });

  it("returns a smaller trailing batch when the remainder is short", () => {
    const { next, slice } = sliceBatch(ids, 10, 5);
    expect(slice).toEqual(["p10", "p11"]);
    expect(next).toBe(12);
  });

  it("returns an empty slice once the cursor exceeds the list", () => {
    const { next, slice } = sliceBatch(ids, 12, 5);
    expect(slice).toEqual([]);
    expect(next).toBe(12);
  });

  it("uses default batch size when not provided", () => {
    const big = Array.from({ length: 75 }, (_, i) => `p${i}`);
    const { slice } = sliceBatch(big, 0);
    expect(slice.length).toBe(50);
  });
});
