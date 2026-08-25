import type { IconName } from "@/components/ui/icon";
import { categoryIcon, categoryLabel } from "./categories";
import type { GoalMap } from "./goals";
import { formatMoney } from "./format";
import {
  ACCOUNT_LABELS,
  goalDirection,
  goalId,
  type AccountKind,
  type Goal,
  type GoalDirection,
  type GoalScope,
  type Transaction,
} from "./types";

/* ── Month totals ───────────────────────────────────────────────────── */

export type MonthSummary = {
  incomeCents: number;
  expenseCents: number;
  /** Income minus expenses. Transfers move money without changing this. */
  netCents: number;
};

/**
 * Transfers are deliberately excluded: moving money from Spending to Savings
 * isn't income or an expense, and counting it as either would double-report
 * money the user already earned. Gains and losses are excluded for the same
 * reason — nobody earned or spent them.
 */
export function summariseMonth(transactions: Transaction[]): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;

  for (const transaction of transactions) {
    if (transaction.kind === "income") incomeCents += transaction.amountCents;
    if (transaction.kind === "expense") expenseCents += transaction.amountCents;
  }

  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

/**
 * Money deliberately moved into an account this month, net of anything moved
 * back out. Interest and market movement are not contributions, so gains and
 * losses don't count toward a savings or investing goal — otherwise a good
 * month on the markets would look like the user hit a target they never
 * actually funded.
 */
export function contributionTo(
  transactions: Transaction[],
  account: AccountKind,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.kind !== "transfer") return sum;
    if (transaction.toAccountId === account) return sum + transaction.amountCents;
    if (transaction.accountId === account) return sum - transaction.amountCents;
    return sum;
  }, 0);
}

/** Gains minus losses recorded against an account this month. */
export function growthFor(
  transactions: Transaction[],
  account: AccountKind,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.accountId !== account) return sum;
    if (transaction.kind === "gain") return sum + transaction.amountCents;
    if (transaction.kind === "loss") return sum - transaction.amountCents;
    return sum;
  }, 0);
}

/** Every way an account moved this month, for the qualitative account lines. */
export function accountActivity(
  transactions: Transaction[],
  account: AccountKind,
) {
  const summary = summariseMonth(transactions);
  return {
    contributionCents: contributionTo(transactions, account),
    growthCents: growthFor(transactions, account),
    incomeCents: account === "spending" ? summary.incomeCents : 0,
    expenseCents: account === "spending" ? summary.expenseCents : 0,
  };
}

/* ── Spending by category ───────────────────────────────────────────── */

export type CategorySpend = {
  categoryId: string;
  label: string;
  icon: IconName;
  amountCents: number;
  /** 0-1 of the month's total expenses. */
  share: number;
};

/** Expense totals per category, largest first. Categories with no spend are omitted. */
export function expensesByCategory(
  transactions: Transaction[],
): CategorySpend[] {
  const totals = new Map<string, number>();

  for (const transaction of transactions) {
    if (transaction.kind !== "expense") continue;
    const key = transaction.categoryId ?? "other-expense";
    totals.set(key, (totals.get(key) ?? 0) + transaction.amountCents);
  }

  const totalCents = [...totals.values()].reduce((sum, cents) => sum + cents, 0);

  return [...totals.entries()]
    .map(([categoryId, amountCents]) => ({
      categoryId,
      label: categoryLabel(categoryId),
      icon: categoryIcon(categoryId),
      amountCents,
      share: totalCents === 0 ? 0 : amountCents / totalCents,
    }))
    .sort((a, b) => b.amountCents - a.amountCents);
}

export function spendForCategory(
  transactions: Transaction[],
  categoryId: string,
): number {
  return transactions.reduce(
    (sum, transaction) =>
      transaction.kind === "expense" && transaction.categoryId === categoryId
        ? sum + transaction.amountCents
        : sum,
    0,
  );
}

/* ── How far into the month we are ──────────────────────────────────── */

/**
 * 0-1 through the month being viewed. A finished month is 1, which is what
 * makes "on pace" collapse into a plain "did you make it?" once the month is
 * over — the same code answers both questions.
 */
export function monthElapsed(monthStart: Date, now: Date = new Date()): number {
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
  );
  if (now >= monthEnd) return 1;
  if (now <= monthStart) return 0;
  return (
    (now.getTime() - monthStart.getTime()) /
    (monthEnd.getTime() - monthStart.getTime())
  );
}

/* ── Goal progress ──────────────────────────────────────────────────── */

export type GoalStatus = "good" | "watch" | "bad";

export type GoalProgress = {
  goal: Goal;
  label: string;
  icon: IconName;
  direction: GoalDirection;
  actualCents: number;
  targetCents: number;
  /** actual ÷ target, uncapped, so overspend stays visible. */
  share: number;
  status: GoalStatus;
  /** Plain-language state — the headline the UI leads with. */
  summary: string;
};

const SCOPE_ICON: Record<Exclude<GoalScope, "expense">, IconName> = {
  income: "banknote",
  savings: "vault",
  investments: "trendUp",
};

export function goalLabel(goal: Goal): string {
  if (goal.scope === "expense") return categoryLabel(goal.categoryId);
  return goal.scope === "income" ? "Income" : ACCOUNT_LABELS[goal.scope];
}

export function goalIcon(goal: Goal): IconName {
  return goal.scope === "expense"
    ? categoryIcon(goal.categoryId)
    : SCOPE_ICON[goal.scope];
}

function actualFor(goal: Goal, transactions: Transaction[]): number {
  switch (goal.scope) {
    case "income":
      return summariseMonth(transactions).incomeCents;
    case "savings":
    case "investments":
      return contributionTo(transactions, goal.scope);
    case "expense":
      return goal.categoryId
        ? spendForCategory(transactions, goal.categoryId)
        : 0;
  }
}

/**
 * Grades a goal against how much of the month has actually gone by.
 *
 * Half a grocery budget spent on the 3rd is a problem; the same figure on the
 * 28th is a good month. Comparing the share used against the share of the
 * month elapsed is what lets one sentence say which of the two it is.
 */
function gradeGoal(
  direction: GoalDirection,
  share: number,
  elapsed: number,
): { status: GoalStatus; summary: string } {
  if (direction === "under") {
    if (share > 1) return { status: "bad", summary: "Over the limit" };
    // Spending the budget exactly is the budget working, not a warning. A
    // fixed monthly cost hits this every month and should never read as a
    // problem.
    if (share >= 1) return { status: "good", summary: "Fully used" };
    if (elapsed >= 1) return { status: "good", summary: "Stayed under" };
    if (share >= 0.9) return { status: "watch", summary: "Almost used up" };
    if (share > elapsed + 0.15) return { status: "watch", summary: "Spending fast" };
    if (share < 0.5) return { status: "good", summary: "Plenty left" };
    return { status: "good", summary: "On pace" };
  }

  if (share >= 1) return { status: "good", summary: "Reached" };
  if (elapsed >= 1) {
    return share >= 0.85
      ? { status: "watch", summary: "Just short" }
      : { status: "bad", summary: "Missed" };
  }
  if (share >= elapsed - 0.15) return { status: "good", summary: "On pace" };
  if (share >= elapsed - 0.4) return { status: "watch", summary: "A little behind" };
  return { status: "bad", summary: "Behind" };
}

export function goalProgress(
  goal: Goal,
  transactions: Transaction[],
  elapsed: number,
): GoalProgress {
  const direction = goalDirection(goal.scope);
  // A withdrawal can push a contribution negative; treated as zero progress
  // rather than a negative bar, which has nothing to mean.
  const actualCents = Math.max(0, actualFor(goal, transactions));
  const share = goal.amountCents === 0 ? 0 : actualCents / goal.amountCents;

  return {
    goal,
    label: goalLabel(goal),
    icon: goalIcon(goal),
    direction,
    actualCents,
    targetCents: goal.amountCents,
    share,
    ...gradeGoal(direction, share, elapsed),
  };
}

/** Goal order: whatever needs attention first, then by how far along it is. */
const STATUS_RANK: Record<GoalStatus, number> = { bad: 0, watch: 1, good: 2 };

export function allGoalProgress(
  goals: GoalMap,
  transactions: Transaction[],
  elapsed: number,
): GoalProgress[] {
  return Object.values(goals)
    .map((goal) => goalProgress(goal, transactions, elapsed))
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.share - a.share,
    );
}

export type GoalRollup = {
  total: number;
  good: number;
  needsAttention: GoalProgress[];
  /** One sentence for the dashboard strip. */
  headline: string;
  status: GoalStatus | "none";
};

export function rollUpGoals(progress: GoalProgress[]): GoalRollup {
  const good = progress.filter((entry) => entry.status === "good").length;
  const needsAttention = progress.filter((entry) => entry.status !== "good");

  if (progress.length === 0) {
    return {
      total: 0,
      good: 0,
      needsAttention: [],
      headline: "No goals set yet",
      status: "none",
    };
  }

  if (needsAttention.length === 0) {
    return {
      total: progress.length,
      good,
      needsAttention,
      headline:
        progress.length === 1
          ? "Your one goal is on track"
          : `All ${progress.length} goals are on track`,
      status: "good",
    };
  }

  const worst = needsAttention.some((entry) => entry.status === "bad")
    ? "bad"
    : "watch";

  return {
    total: progress.length,
    good,
    needsAttention,
    headline: `${good} of ${progress.length} goals on track`,
    status: worst,
  };
}

/* ── Plain-language summaries ───────────────────────────────────────── */

function shareInWords(share: number): string {
  if (share >= 0.85) return "nearly all";
  if (share >= 0.6) return "most";
  if (share >= 0.45) return "about half";
  if (share >= 0.3) return "about a third";
  if (share >= 0.2) return "about a quarter";
  if (share >= 0.12) return "roughly a sixth";
  return "a small slice";
}

export type Verdict = {
  headline: string;
  detail: string;
  tone: GoalStatus | "neutral";
  icon: IconName;
};

/** The one sentence the dashboard leads with. */
export function monthVerdict(
  transactions: Transaction[],
  monthLabel: string,
): Verdict {
  const { incomeCents, expenseCents, netCents } = summariseMonth(transactions);

  if (incomeCents === 0 && expenseCents === 0) {
    return {
      headline: `Nothing recorded in ${monthLabel} yet`,
      detail: "Add an income or an expense and this fills in.",
      tone: "neutral",
      icon: "sparkle",
    };
  }

  if (netCents > 0) {
    return {
      headline: "You're keeping more than you spend",
      detail: `${formatMoney(netCents)} more came in than went out.`,
      tone: "good",
      icon: "check",
    };
  }

  if (netCents < 0) {
    return {
      headline: "You're spending more than you earn",
      detail: `${formatMoney(-netCents)} more went out than came in.`,
      tone: "bad",
      icon: "alert",
    };
  }

  return {
    headline: "You broke exactly even",
    detail: "Everything that came in went back out.",
    tone: "watch",
    icon: "swap",
  };
}

/** The sentence above the category breakdown. */
export function spendingHeadline(rows: CategorySpend[]): string {
  if (rows.length === 0) return "No expenses recorded this month.";
  if (rows.length === 1) {
    return `Everything you spent went on ${rows[0].label.toLowerCase()}.`;
  }
  return `${rows[0].label} took ${shareInWords(rows[0].share)} of your spending, ahead of ${rows[1].label.toLowerCase()}.`;
}


/* ── Allocation: everything is budgeted out of income ───────────────── */

export type Allocation = {
  /** null when no income target has been set. */
  incomeTargetCents: number | null;
  /** Savings + investments + every expense limit. */
  allocatedCents: number;
  /** Income target minus what's allocated; negative means over-committed. */
  unallocatedCents: number;
};

export function allocationOf(goals: GoalMap): Allocation {
  let incomeTargetCents: number | null = null;
  let allocatedCents = 0;

  for (const goal of Object.values(goals)) {
    if (goal.scope === "income") incomeTargetCents = goal.amountCents;
    else allocatedCents += goal.amountCents;
  }

  return {
    incomeTargetCents,
    allocatedCents,
    unallocatedCents: (incomeTargetCents ?? 0) - allocatedCents,
  };
}

/**
 * Checks a proposed goal against the income it has to come out of.
 *
 * A budget that lets you promise more than you earn isn't a budget, so every
 * saving, investment and limit is spent from the income target and the total
 * can't exceed it. Returns the reason it can't be saved, or null.
 */
export function checkAllocation(
  goals: GoalMap,
  scope: GoalScope,
  categoryId: string | null,
  amountCents: number,
): string | null {
  const { incomeTargetCents, allocatedCents } = allocationOf(goals);
  const existing = goals[goalId(scope, categoryId)]?.amountCents ?? 0;

  if (scope === "income") {
    if (amountCents < allocatedCents) {
      return `That's less than the ${formatMoney(
        allocatedCents,
      )} you've already promised to savings, investing and spending limits. Lower those first, or set a higher target.`;
    }
    return null;
  }

  if (incomeTargetCents === null) {
    return "Set your income target first — everything else is budgeted out of it.";
  }

  const proposed = allocatedCents - existing + amountCents;
  if (proposed > incomeTargetCents) {
    const over = proposed - incomeTargetCents;
    const free = incomeTargetCents - (allocatedCents - existing);
    return `That would put you ${formatMoney(over)} over your income target. You have ${formatMoney(
      Math.max(0, free),
    )} left to allocate.`;
  }

  return null;
}
