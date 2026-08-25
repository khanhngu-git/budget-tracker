import type { Timestamp } from "firebase/firestore";

/** Fixed document ids — every user has exactly these three accounts. */
export const ACCOUNT_KINDS = ["spending", "savings", "investments"] as const;
export type AccountKind = (typeof ACCOUNT_KINDS)[number];

export const ACCOUNT_LABELS: Record<AccountKind, string> = {
  spending: "Spending",
  savings: "Savings",
  investments: "Investments",
};

export const ACCOUNT_BLURBS: Record<AccountKind, string> = {
  spending: "Day-to-day money",
  savings: "Set aside for later",
  investments: "Long-term growth",
};

export type Account = {
  kind: AccountKind;
  /** Integer cents — money is never held in a float. */
  balanceCents: number;
};

/**
 * `gain` and `loss` are balance adjustments: growth or shrinkage that nobody
 * moved. They keep `amountCents` positive like every other kind and carry the
 * direction in the kind itself, so the "amounts are never signed" rule holds
 * across the whole ledger.
 */
export const TRANSACTION_KINDS = [
  "income",
  "expense",
  "transfer",
  "gain",
  "loss",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

export type Transaction = {
  id: string;
  kind: TransactionKind;
  /** The account the entry acts on. For income/expense this is always "spending". */
  accountId: AccountKind;
  /** Destination — transfers only. */
  toAccountId: AccountKind | null;
  /** Always positive; `kind` carries the direction. */
  amountCents: number;
  /** Spending-account income/expense only; null everywhere else. */
  categoryId: string | null;
  note: string;
  date: Date;
};

export type TransactionDoc = Omit<Transaction, "id" | "date"> & {
  date: Timestamp;
  createdAt: Timestamp;
};

/* ── Goals ──────────────────────────────────────────────────────────── */

/**
 * What a goal measures. Expense goals are ceilings to stay under; the other
 * three are floors to reach, which is why direction is derived from the scope
 * rather than stored — a savings target you're meant to stay *below* would be
 * a bug, not a feature.
 */
export const GOAL_SCOPES = [
  "income",
  "savings",
  "investments",
  "expense",
] as const;
export type GoalScope = (typeof GOAL_SCOPES)[number];

export type GoalDirection = "atLeast" | "under";

export function goalDirection(scope: GoalScope): GoalDirection {
  return scope === "expense" ? "under" : "atLeast";
}

export type Goal = {
  /** Document id: "expense:groceries", "income", "savings", "investments". */
  id: string;
  scope: GoalScope;
  /** Expense goals only — which category the ceiling applies to. */
  categoryId: string | null;
  amountCents: number;
};

/**
 * Only expense goals are per-category, so every other scope collapses to a
 * single document and can't be created twice by accident.
 */
export function goalId(scope: GoalScope, categoryId: string | null): string {
  return scope === "expense" ? `expense:${categoryId}` : scope;
}
