"use server";

import type { MoneySiteCreate } from "@repo/api-types";
import { createMoneySite, requestCrawl } from "@repo/money-sites";
import { revalidatePath } from "next/cache";

import { audit } from "@/lib/access";
import { withAuth } from "@/lib/server-action";

export const createMoneySiteAction = async (input: MoneySiteCreate) =>
  withAuth(async () => {
    const site = await createMoneySite(input);
    await audit({ action: "moneysite.create", target: `moneysite:${site.id}` });
    revalidatePath("/dashboard/money-sites");
  });

export const recrawlMoneySiteAction = async (id: string) =>
  withAuth(async () => {
    await requestCrawl(id);
    await audit({ action: "moneysite.recrawl", target: `moneysite:${id}` });
    revalidatePath("/dashboard/money-sites");
    revalidatePath(`/dashboard/money-sites/${id}`);
  });
