import type { Timestamp } from "firebase/firestore";
import type { Frequency } from "./recurrence";
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
  "debt",
] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  spending: "Spending",
  cash: "Cash",
  savings: "Savings",
  investments: "Investments",
  debt: "Loan or debt",
};

export const ACCOUNT_TYPE_BLURBS: Record<AccountType, string> = {
  spending: "Day-to-day money",
  cash: "Notes and coins in hand",
  savings: "Set aside for later",
  investments: "Long-term growth",
  debt: "Money you owe",
};

export const ACCOUNT_TYPE_ICONS: Record<AccountType, IconName> = {
  spending: "wallet",
  cash: "coins",
  savings: "vault",
  investments: "trendUp",
  debt: "debt",
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

/**
 * An account whose balance is what you owe rather than what you have.
 *
 * It is stored as an ordinary negative balance — a £2,400 card is
 * `-240000` — so every total in the app already nets it off without a special
 * case, and net worth is the plain sum it always was. What changes is the
 * wording: "you owe" rather than "you have", and paying it down is a transfer
 * *into* it that moves the balance up toward zero.
 */
export function isDebt(type: AccountType): boolean {
  return type === "debt";
}

/**
 * Accounts an everyday expense can be charged to.
 *
 * A credit card is spent from exactly like a current account — the money just
 * isn't yours yet — so refusing to charge an expense to one would push people
 * into recording card spending against the wrong account.
 */
export function canSpendFrom(type: AccountType): boolean {
  return isEveryday(type) || isDebt(type);
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
  /**
   * When the entry was recorded, as opposed to the day it happened.
   *
   * `date` comes from a date input and is always local midnight, so every
   * entry sharing a day ties on it exactly and needs this to break the tie.
   * Null only for an entry written before this field existed.
   */
  createdAt: Date | null;
  /** Set when a recurring rule posted this entry; null when a person did. */
  recurringId: string | null;
};

export type TransactionDoc = Omit<
  Transaction,
  "id" | "date" | "createdAt"
> & {
  date: Timestamp;
  createdAt: Timestamp;
};

/* ── Recurring entries ──────────────────────────────────────────────── */

/**
 * The kinds worth scheduling. `gain` and `loss` are deliberately absent:
 * they record movement nobody made — interest, a market swing — which is
 * precisely the thing you cannot know the size of in advance.
 */
export const RECURRING_KINDS = ["income", "expense", "transfer"] as const;
export type RecurringKind = (typeof RECURRING_KINDS)[number];

/**
 * A standing instruction: this entry, this often, until further notice.
 *
 * The rule is not a transaction. It posts them — one per occurrence, ordinary
 * entries in the same ledger as everything else, so a scheduled salary settles
 * and can be corrected exactly like a typed one.
 */
export type RecurringRule = {
  id: string;
  kind: RecurringKind;
  accountId: string;
  /** Transfers only. */
  toAccountId: string | null;
  /** Income and expenses only. */
  categoryId: string | null;
  /** Always positive; `kind` carries the direction. */
  amountCents: number;
  note: string;
  frequency: Frequency;
  startDate: Date;
  /** null means "until further notice". */
  endDate: Date | null;
  /**
   * The last occurrence already posted, or null if it has never run. This is
   * the only thing standing between a second tab and a double-posted salary.
   */
  lastRunDate: Date | null;
  /** A paused rule stays in the list and stops firing. */
  active: boolean;
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
