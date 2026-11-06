"use server";

import * as Sites from "@repo/sites";
import { z } from "zod";

import { settle, withAuth } from "@/lib/server-action";

import { checkNameSchema, createFixAdvice } from "./fix-advice";
import { generateFixAdvice } from "./fix-advice-generator";

const adviceFor = createFixAdvice(generateFixAdvice);

const BULK_CONCURRENCY = 8;

const checkNamesSchema = z.array(checkNameSchema).min(1).max(100);

export const getFixAdviceAction = async (siteId: string, checkName: string) =>
  withAuth(async () => adviceFor(await Sites.load(siteId), checkNameSchema.parse(checkName)));

export const bulkGenerateFixAdviceAction = async (
  siteId: string,
  checkNames: ReadonlyArray<string>,
) =>
  withAuth(async () => {
    const site = await Sites.load(siteId);
    const unique = [...new Set(checkNamesSchema.parse(checkNames))];

    const adviceResult = async (checkName: string) => ({
      checkName,
      result: await settle(async () => adviceFor(site, checkName)),
    });

    const results: Array<Awaited<ReturnType<typeof adviceResult>>> = [];

    for (let i = 0; i < unique.length; i += BULK_CONCURRENCY) {
      results.push(...(await Promise.all(unique.slice(i, i + BULK_CONCURRENCY).map(adviceResult))));
    }

    return results;
  });
