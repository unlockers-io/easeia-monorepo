import { LinkType } from "@repo/db";
import { describe, expect, it } from "vitest";

import { pickTopByRecencyAndType, type LinkRow } from "./select";

const row = (over: Partial<LinkRow>): LinkRow => ({
  anchorText: "A",
  id: "l1",
  suggestedAt: new Date("2026-01-01"),
  toPost: { id: "t1", slug: "x", title: "X" },
  toUrl: "https://x.tld/x",
  type: LinkType.INTERNAL,
  ...over,
});

describe("pickTopByRecencyAndType", () => {
  it("dedupes by toPostId", () => {
    const out = pickTopByRecencyAndType(
      [
        row({ id: "a", toPost: { id: "t1", slug: "x", title: "X" } }),
        row({ id: "b", toPost: { id: "t1", slug: "x", title: "X" } }),
      ],
      3,
    );
    expect(out).toHaveLength(1);
  });

  it("returns up to N rows", () => {
    const out = pickTopByRecencyAndType(
      [
        row({ id: "a", toPost: { id: "t1", slug: "1", title: "T1" } }),
        row({ id: "b", toPost: { id: "t2", slug: "2", title: "T2" } }),
        row({ id: "c", toPost: { id: "t3", slug: "3", title: "T3" } }),
        row({ id: "d", toPost: { id: "t4", slug: "4", title: "T4" } }),
      ],
      3,
    );
    expect(out).toHaveLength(3);
  });
});
