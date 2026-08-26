import type { Timestamp } from "firebase/firestore";
import type { IconName } from "@/components/ui/icon";

/* ── Accounts ───────────────────────────────────────────────────────── */

/**
 * What an account *is*, as opposed to what it's called.
 *
 * The name is the user's — "Monzo", "Coin jar", "Vanguard" — and can be
 * anything, so it can't be what the app reasons about. The type is the part
 * with meaning: it decides whether everyday income and expenses can land here,
 * and which savings or investing goal a transfer counts toward.
 */
export const ACCOUNT_TYPES = [
  "spending",
  "cash",
  "savings",
  "investments",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  spending: "Spending",
  cash: "Cash",
  savings: "Savings",
  investments: "Investments",
};

export const ACCOUNT_TYPE_BLURBS: Record<AccountType, string> = {
  spending: "Day-to-day money",
  cash: "Notes and coins in hand",
  savings: "Set aside for later",
  investments: "Long-term growth",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, IconName> = {
  spending: "wallet",
  cash: "coins",
  savings: "vault",
  investments: "trendUp",
};

/**
 * Money you spend from directly. Income and expenses are recorded against one
 * of these; savings and investments change through transfers and adjustments,
 * so that a month's spending can't be quietly funded out of the retirement pot
 * without the transfer that really made it possible.
 */
export function isEveryday(type: AccountType): boolean {
  return type === "spending" || type === "cash";
}

export type Account = {
  /** Firestore document id. Stable — transactions reference it forever. */
  id: string;
  /** The user's own name for it. */
  name: string;
  type: AccountType;
  /** Integer cents — money is never held in a float. */
  balanceCents: number;
  /** Display position, so reordering never depends on the name. */
  order: number;
};

/**
 * Categorical slots 1-8 of the validated palette, assigned to accounts by
 * position and never re-ordered by size, so a filter or a good month can't
 * repaint a line the reader has already learned. Past the eighth account the
 * identity channel is exhausted; the rest fold into one muted "Other" series
 * rather than inventing a ninth hue nobody can tell from the first eight.
 */
export const SERIES_SLOTS = 8;

export function seriesColor(index: number): string {
  return index < SERIES_SLOTS ? `var(--series-${index + 1})` : "var(--muted)";
}

/* ── Transactions ───────────────────────────────────────────────────── */

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
  /** The account the entry acts on — the source, for a transfer. */
  accountId: string;
  /** Destination — transfers only. */
  toAccountId: string | null;
  /** Always positive; `kind` carries the direction. */
  amountCents: number;
  /** Income and expenses only; null everywhere else. */
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
 *
 * `savings` and `investments` name an account *type*, not one account, so
 * splitting your savings across three pots doesn't split the goal with it.
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
