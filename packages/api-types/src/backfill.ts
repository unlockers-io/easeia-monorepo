import { z } from "zod";

export const backfillRunStatusSchema = z.object({
  active: z.boolean(),
  counts: z.record(z.string(), z.number()).optional(),
  ended: z.enum(["done", "failed"]).nullable().optional(),
  phase: z.string().optional(),
  runId: z.string().optional(),
  startedAt: z.string().optional(),
});
