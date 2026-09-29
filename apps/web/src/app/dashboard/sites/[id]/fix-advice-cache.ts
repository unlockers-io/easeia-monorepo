import { type FixAdvice, type FixAdviceInput, generateFixAdvice } from "@repo/ai";

const adviceCache = new Map<string, FixAdvice>();

const cacheKey = (siteId: string, checkName: string): string => `${siteId}::${checkName}`;

export type FixAdviceGenerator = (input: FixAdviceInput) => Promise<FixAdvice>;

let generator: FixAdviceGenerator = generateFixAdvice;

export const getCachedAdvice = (siteId: string, checkName: string): FixAdvice | undefined =>
  adviceCache.get(cacheKey(siteId, checkName));

export const setCachedAdvice = (siteId: string, checkName: string, advice: FixAdvice): void => {
  adviceCache.set(cacheKey(siteId, checkName), advice);
};

export const callGenerator = (input: FixAdviceInput): Promise<FixAdvice> => generator(input);

export const resetFixAdviceCacheForTests = (): void => {
  adviceCache.clear();
};

export const setFixAdviceGeneratorForTests = (next: FixAdviceGenerator): void => {
  generator = next;
};

export const resetFixAdviceGeneratorForTests = (): void => {
  generator = generateFixAdvice;
};
