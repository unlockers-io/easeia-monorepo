import { prisma } from "@repo/db";
import { afterAll, describe, expect, it } from "vitest";

import { budgetStore } from "./budget-store";

// Only enable against a disposable database; the test owns these month rows.
describe.runIf(process.env.TEST_AI_BUDGET_DATABASE === "true")("Postgres AI allowance", () => {
  const month = "test-atomic";
  const nextMonth = "test-next";

  afterAll(async () => {
    await prisma.aiMonthlyBudget.deleteMany({ where: { month: { in: [month, nextMonth] } } });
    await prisma.$disconnect();
  });

  it("atomically limits concurrent reservations, refunds, and halts an underestimated month", async () => {
    await prisma.aiMonthlyBudget.deleteMany({ where: { month: { in: [month, nextMonth] } } });
    const results = await Promise.all(
      Array.from({ length: 40 }, () => budgetStore.reserve(month, 100, 1000)),
    );
    expect(results.filter(Boolean)).toHaveLength(10);
    const row = await prisma.aiMonthlyBudget.findUniqueOrThrow({ where: { month } });
    expect(row.usedMicroUsd).toBe(1000n);
    await budgetStore.settle(month, 100, 25);
    expect(await budgetStore.reserve(month, 75, 1000)).toBe(true);
    expect(await budgetStore.reserve(month, 1, 1000)).toBe(false);
    await budgetStore.settle(month, 100, 150);
    expect(await budgetStore.reserve(month, 1, 2000)).toBe(false);
    expect(await budgetStore.reserve(nextMonth, 100, 1000)).toBe(true);
  });
});
