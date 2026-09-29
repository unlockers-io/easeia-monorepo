import { JobKind, JobStatus } from "@repo/db/browser";
import { z } from "zod";

export const jobListQuerySchema = z.object({
  cursor: z.string().optional(),
  kind: z.enum(JobKind).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  postId: z.string().optional(),
  siteId: z.string().optional(),
  status: z.enum(JobStatus).optional(),
});

export type JobListQuery = z.infer<typeof jobListQuerySchema>;
