import { GOAL_SCOPES, canSpendFrom, type Account, type GoalScope } from "./types";

/**
 * Which kinds of goal this user can actually set.
 *
 * A savings goal is measured by what lands in savings accounts, so with none
 * open it can only ever read zero — the goal would be permanently, silently
 * failing at something the user never had the means to do. The same holds for
 * investing. Offering it and then reporting nothing is worse than not
 * offering it: the number looks like a verdict rather than a missing account.
 *
 * Income and spending limits ride on the everyday accounts, which the app
 * requires before any of this is reachable at all.
 */
export function availableScopes(accounts: Account[]): Set<GoalScope> {
  const types = new Set(accounts.map((account) => account.type));
  const everyday = accounts.some((account) => canSpendFrom(account.type));

  return new Set(
    GOAL_SCOPES.filter((scope) => {
      switch (scope) {
        case "savings":
          return types.has("savings");
        case "investments":
          return types.has("investments");
        case "debt":
          return types.has("debt");
        case "income":
        case "expense":
          return everyday;
      }
    }),
  );
}

/** Why a scope isn't on offer, phrased as the thing to go and do about it. */
export const SCOPE_REQUIREMENT: Record<GoalScope, string> = {
  income: "Add an everyday account first.",
  savings: "Add a savings account first.",
  investments: "Add an investments account first.",
  debt: "Add a loan, credit card or mortgage first.",
  expense: "Add an everyday account first.",
};
