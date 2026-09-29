import { prisma } from "@repo/db";

type AiBudgetStore = {
  reserve: (month: string, amount: number, limit: number) => Promise<boolean>;
  settle: (month: string, reserved: number, cost: number) => Promise<void>;
};

const budgetStore: AiBudgetStore = {
  reserve: async (month, amount, limit) => {
    if (amount > limit) {
      return false;
    }
    await prisma.aiMonthlyBudget.createMany({
      data: [{ month }],
      skipDuplicates: true,
    });
    const result = await prisma.aiMonthlyBudget.updateMany({
      data: { usedMicroUsd: { increment: BigInt(amount) } },
      where: {
        halted: false,
        month,
        usedMicroUsd: { lte: BigInt(limit - amount) },
      },
    });
    return result.count === 1;
  },
  settle: async (month, reserved, cost) => {
    await prisma.aiMonthlyBudget.update({
      data: {
        halted: cost > reserved ? true : undefined,
        usedMicroUsd: { increment: BigInt(cost - reserved) },
      },
      where: { month },
    });
  },
};

export { budgetStore };
export type { AiBudgetStore };
