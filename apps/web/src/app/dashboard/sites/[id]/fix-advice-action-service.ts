import { AiNotConfiguredError, type FixAdvice } from "@repo/ai";
import { z } from "zod";

const checkNameSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-z0-9_]+$/v, "Invalid check name");

const fixAdviceInputSchema = z.object({
  checkName: checkNameSchema,
  siteId: z.string().min(1),
});

type FixAdviceActionInput = z.infer<typeof fixAdviceInputSchema>;
type FixAdviceActionResult = { data: FixAdvice; ok: true } | { error: string; ok: false };
type AuthenticatedSession = { user: { id: string } };

type FixAdviceActionDependencies = {
  findSite: (siteId: string) => Promise<{
    domain: string;
    niches: ReadonlyArray<string>;
  } | null>;
  generate: (input: {
    checkName: string;
    site: { domain: string; niches: ReadonlyArray<string> };
  }) => Promise<FixAdvice>;
  getCached: (siteId: string, checkName: string) => FixAdvice | undefined;
  getSession: () => Promise<AuthenticatedSession | null>;
  logError: (input: { checkName: string; error: string; siteId: string }) => void;
  setCached: (siteId: string, checkName: string, advice: FixAdvice) => void;
};

const createGetFixAdviceAction =
  (dependencies: FixAdviceActionDependencies) =>
  async (input: FixAdviceActionInput): Promise<FixAdviceActionResult> => {
    if (!(await dependencies.getSession())) {
      return { error: "Not authenticated.", ok: false };
    }
    const parsed = fixAdviceInputSchema.safeParse(input);
    if (!parsed.success) {
      return { error: "Invalid input.", ok: false };
    }
    const { checkName, siteId } = parsed.data;
    const cached = dependencies.getCached(siteId, checkName);
    if (cached) {
      return { data: cached, ok: true };
    }

    const site = await dependencies.findSite(siteId);
    if (!site) {
      return { error: "Site not found.", ok: false };
    }

    try {
      const advice = await dependencies.generate({
        checkName,
        site: { domain: site.domain, niches: site.niches },
      });
      dependencies.setCached(siteId, checkName, advice);
      return { data: advice, ok: true };
    } catch (error) {
      if (error instanceof AiNotConfiguredError) {
        return { error: "OPENAI_API_KEY is not configured on this server.", ok: false };
      }
      dependencies.logError({
        checkName,
        error: error instanceof Error ? error.message : String(error),
        siteId,
      });
      return { error: "Could not generate fix advice.", ok: false };
    }
  };

export { checkNameSchema, createGetFixAdviceAction };
export type { FixAdviceActionDependencies };
