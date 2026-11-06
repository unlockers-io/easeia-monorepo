import { describe, expect, it, vi } from "vitest";

import { checkNameSchema, createFixAdvice } from "./fix-advice";
import type { FixAdviceInput } from "./fix-advice-generator";

const site = { domain: "example.com", id: "site_1", niches: ["WEDDING"] };
const advice = { problem: "Responses ship uncompressed." };

const setup = () => {
  const generate = vi.fn<(input: FixAdviceInput) => Promise<typeof advice>>(() =>
    Promise.resolve(advice),
  );

  return { adviceFor: createFixAdvice(generate), generate };
};

describe("createFixAdvice", () => {
  it("returns the advice and forwards site context + check name to the generator", async () => {
    const { adviceFor, generate } = setup();

    expect(await adviceFor(site, "no_content_encoding")).toBe(advice);
    expect(generate).toHaveBeenCalledWith({
      checkName: "no_content_encoding",
      site: { domain: "example.com", niches: ["WEDDING"] },
    });
  });

  it("caches by site and check name", async () => {
    const { adviceFor, generate } = setup();

    await adviceFor(site, "is_redirect");
    await adviceFor(site, "is_redirect");
    await adviceFor(site, "is_4xx_code");
    await adviceFor({ ...site, domain: "other.com", id: "site_2" }, "is_redirect");

    expect(generate).toHaveBeenCalledTimes(3);
  });
});

describe("checkNameSchema", () => {
  it("rejects malformed check names", () => {
    expect(checkNameSchema.safeParse("no_content_encoding").success).toBe(true);
    expect(checkNameSchema.safeParse("DROP TABLE sites;").success).toBe(false);
  });
});
