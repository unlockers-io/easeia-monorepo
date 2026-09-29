import { describe, expect, it } from "vitest";

import { parseExternalBacklinksCsv } from "./external-backlinks-csv";

describe("parseExternalBacklinksCsv", () => {
  it("parses a clean GSC export", () => {
    const csv = [
      "Site,Pages linking to your site",
      "forbes.com,42",
      "nytimes.com,17",
      "techcrunch.com,3",
    ].join("\n");

    const result = parseExternalBacklinksCsv(csv);
    expect(result.rows).toEqual([
      { linkingPages: 42, sourceDomain: "forbes.com" },
      { linkingPages: 17, sourceDomain: "nytimes.com" },
      { linkingPages: 3, sourceDomain: "techcrunch.com" },
    ]);
    expect(result.skipped).toBe(0);
  });

  it("strips a UTF-8 BOM and normalizes scheme/www prefixes", () => {
    const bom = "﻿";
    const csv = [
      `${bom}Site,Pages linking to your site`,
      "https://www.forbes.com/,42",
      "WWW.NYTIMES.COM,17",
    ].join("\n");

    const result = parseExternalBacklinksCsv(csv);
    expect(result.rows).toEqual([
      { linkingPages: 42, sourceDomain: "forbes.com" },
      { linkingPages: 17, sourceDomain: "nytimes.com" },
    ]);
    expect(result.skipped).toBe(0);
  });

  it("skips junk rows, blank lines, the self-domain, and duplicate domains", () => {
    const csv = [
      "Top linking sites", // stray title row (some GSC exports include one)
      "",
      "Site,Pages linking to your site",
      "forbes.com,42",
      "",
      "not-a-domain,7",
      "example.com,9", // self-domain
      "forbes.com,99", // duplicate of an earlier row
      "techcrunch.com,abc", // unparseable count
      "nytimes.com,0", // zero-count row
      "nytimes.com,5", // valid after the zero-count skip
    ].join("\n");

    const result = parseExternalBacklinksCsv(csv, { selfDomain: "example.com" });
    expect(result.rows).toEqual([
      { linkingPages: 42, sourceDomain: "forbes.com" },
      { linkingPages: 5, sourceDomain: "nytimes.com" },
    ]);
    expect(result.skipped).toBeGreaterThan(0);
  });

  it("tolerates CRLF line endings and quoted fields", () => {
    const csv = 'Site,Pages linking to your site\r\n"forbes.com",42\r\n"nytimes.com","17"\r\n';
    const result = parseExternalBacklinksCsv(csv);
    expect(result.rows).toEqual([
      { linkingPages: 42, sourceDomain: "forbes.com" },
      { linkingPages: 17, sourceDomain: "nytimes.com" },
    ]);
  });

  it("returns no rows when the header is missing", () => {
    const csv = ["forbes.com,42", "nytimes.com,17"].join("\n");
    const result = parseExternalBacklinksCsv(csv);
    expect(result.rows).toEqual([]);
  });
});
