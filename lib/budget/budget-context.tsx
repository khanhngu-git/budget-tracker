"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { startOfMonth, useBudget } from "./use-budget";

type BudgetContextValue = ReturnType<typeof useBudget> & {
  /** Local midnight on the 1st of the month currently being viewed. */
  monthStart: Date;
  setMonthStart: (next: Date) => void;
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

/**
 * Holds the selected month for the whole dashboard and opens the Firestore
 * subscriptions once, above the pages.
 *
 * Lifting it here is what makes the month a genuine view filter: Overview,
 * Transactions and Budgets all read the same month, so stepping back in
 * Transactions and then switching to Budgets doesn't silently snap back to
 * today. It also means three pages share one set of listeners instead of
 * tearing down and re-opening them on every navigation.
 */
export function BudgetProvider({ children }: { children: ReactNode }) {
  const [monthStart, setMonthStart] = useState(() => startOfMonth(new Date()));
  const budget = useBudget(monthStart);

  const value = useMemo(
    () => ({ ...budget, monthStart, setMonthStart }),
    [budget, monthStart],
  );

  return (
    <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>
  );
}

export function useBudgetContext(): BudgetContextValue {
  const value = useContext(BudgetContext);
  if (!value) {
    throw new Error("useBudgetContext must be used inside <BudgetProvider>.");
  }
  return value;
}
