"use client";
import { z } from "zod";

import { unwrapAction } from "@/lib/action-result";

import { readRewriteStatusAction, startRewriteAction } from "../actions";

import { NetworkRewritePage } from "./status-view";

const countsSchema = z.object({
  failed: z.number(),
  moneySitePagesCrawled: z.number(),
  moneySitePagesTotal: z.number(),
  postsEligible: z.number(),
  postsRewritten: z.number(),
});

const statusSchema = z.object({
  active: z.boolean(),
  counts: countsSchema.optional(),
  phase: z.string().optional(),
  startedAt: z.string().optional(),
});

export type Status = z.infer<typeof statusSchema>;

const fetchStatus = async (): Promise<Status> =>
  statusSchema.parse(unwrapAction(await readRewriteStatusAction()));
const trigger = async (force: boolean): Promise<void> => {
  unwrapAction(await startRewriteAction(force));
};

const Controller = () => <NetworkRewritePage loadStatus={fetchStatus} start={trigger} />;
export default Controller;
