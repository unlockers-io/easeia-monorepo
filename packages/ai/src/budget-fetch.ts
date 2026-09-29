import { monthlyBudgetMicroUsd, monthlyBudgetStartMonth, planAiRequest } from "./budget-policy";
import { budgetStore } from "./budget-store";
import type { AiBudgetStore } from "./budget-store";

class AiBudgetExceededError extends Error {
  constructor(month: string) {
    super(`The AI allowance for ${month} is exhausted. New AI requests resume next month.`);
    this.name = "AiBudgetExceededError";
  }
}

type BudgetFetchDependencies = {
  fetch: typeof globalThis.fetch;
  limit: () => number;
  now: () => Date;
  startMonth: () => string | undefined;
  store: AiBudgetStore;
};

const createBudgetedFetch =
  (dependencies: BudgetFetchDependencies): typeof globalThis.fetch =>
  async (input, init) => {
    const request = new Request(input, init);
    if (request.method !== "POST") {
      throw new Error("Budgeted AI requests must use POST.");
    }
    const month = dependencies.now().toISOString().slice(0, 7);
    const startMonth = dependencies.startMonth();
    if (startMonth !== undefined && month < startMonth) {
      return dependencies.fetch(request);
    }
    const plan = planAiRequest(new URL(request.url), await request.text());
    const reserved = await dependencies.store.reserve(
      month,
      plan.reservedMicroUsd,
      dependencies.limit(),
    );
    if (!reserved) {
      throw new AiBudgetExceededError(month);
    }

    const response = await dependencies.fetch(
      new Request(request, { body: plan.body, method: "POST" }),
    );
    if (!response.ok) {
      return response;
    }

    let json: unknown;
    try {
      json = await response.clone().json();
    } catch {
      return response;
    }
    const cost = plan.costOf(json);
    if (cost === undefined) {
      return response;
    }
    try {
      await dependencies.store.settle(month, plan.reservedMicroUsd, cost);
    } catch {
      // A failed settlement retains the reservation instead of retrying a paid request.
    }
    return response;
  };

const budgetedOpenAiFetch = createBudgetedFetch({
  fetch: (...args) => globalThis.fetch(...args),
  limit: monthlyBudgetMicroUsd,
  now: () => new Date(),
  startMonth: monthlyBudgetStartMonth,
  store: budgetStore,
});

export { AiBudgetExceededError, budgetedOpenAiFetch, createBudgetedFetch };
