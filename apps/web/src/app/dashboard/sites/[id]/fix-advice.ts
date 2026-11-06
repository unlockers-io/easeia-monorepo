import { z } from "zod";

import type { FixAdviceInput } from "./fix-advice-generator";

export const checkNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_]+$/v, "Invalid check name");

type AdviceSite = { domain: string; id: string; niches: ReadonlyArray<string> };

export const createFixAdvice = <Advice>(generate: (input: FixAdviceInput) => Promise<Advice>) => {
  const cache = new Map<string, Advice>();

  return async (site: AdviceSite, checkName: string): Promise<Advice> => {
    const key = `${site.id}::${checkName}`;
    const cached = cache.get(key);

    if (cached !== undefined) {
      return cached;
    }

    const advice = await generate({
      checkName,
      site: { domain: site.domain, niches: site.niches },
    });

    cache.set(key, advice);

    return advice;
  };
};
