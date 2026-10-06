"use server";

import { moneySiteCreateSchema } from "@repo/api-types";
import { JobKind } from "@repo/db";
import { enqueue } from "@repo/jobs";
import { listMoneySites, createMoneySite } from "@repo/money-sites";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { audit } from "@/lib/access";
import { redisUrl } from "@/lib/env";
import { withAuth } from "@/lib/server-action";

export const listMoneySitesAction = async () => withAuth(listMoneySites);
export const createMoneySiteAction = async (input: z.input<typeof moneySiteCreateSchema>) =>
  withAuth(async () => {
    const site = await createMoneySite(moneySiteCreateSchema.parse(input));
    await audit({ action: "moneysite.create", target: `moneysite:${site.id}` });
    revalidatePath("/dashboard/money-sites");
    return site;
  });
export const recrawlMoneySiteAction = async (id: string) =>
  withAuth(async () => {
    const job = await enqueue({
      kind: JobKind.CRAWL_MONEY_SITE,
      payload: { moneySiteId: z.string().min(1).parse(id) },
      redisUrl: redisUrl(),
    });
    await audit({ action: "moneysite.recrawl", target: `moneysite:${id}` });
    return job;
  });
