"use client";
import { z } from "zod";

import { unwrapAction } from "@/lib/action-result";

import { readBackfillStatusAction, startBackfillAction } from "../actions";

import { NetworkBackfillPage } from "./status-view";

const countsSchema = z.object({
  classifiedPosts: z.number(),
  embeddedPosts: z.number(),
  failed: z.number(),
  posts: z.number(),
  sites: z.number(),
  suggestDone: z.number(),
});

const statusSchema = z.object({
  active: z.boolean(),
  counts: countsSchema.optional(),
  phase: z.string().optional(),
  startedAt: z.string().optional(),
});

export type Status = z.infer<typeof statusSchema>;

const fetchStatus = async (): Promise<Status> =>
  statusSchema.parse(unwrapAction(await readBackfillStatusAction()));
const trigger = async (): Promise<void> => {
  unwrapAction(await startBackfillAction());
};

const Controller = () => <NetworkBackfillPage loadStatus={fetchStatus} start={trigger} />;
export default Controller;
