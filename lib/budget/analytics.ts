import type { IconName } from "@/components/ui/icon";
import { categoryIcon, categoryLabel } from "./categories";
import type { GoalMap } from "./goals";
import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  formatDayLong,
  formatDayShort,
  formatMonthLabel,
  formatMonthShort,
  formatMoney,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from "./format";
import { applyLedger, sumBalances, type Deltas } from "./ledger";
import {
  ACCOUNT_TYPE_LABELS,
  goalDirection,
  goalId,
  type Account,
  type AccountType,
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

/** The ids of every account of a given type — what a savings goal measures. */
export function idsOfType(
  accounts: Account[],
  type: AccountType,
): Set<string> {
  return new Set(
    accounts.filter((account) => account.type === type).map((a) => a.id),
  );
}

/**
 * Money deliberately moved into a group of accounts this month, net of
 * anything moved back out.
 *
 * The group is what makes splitting your savings across three pots harmless: a
 * transfer *between* two of them is invisible here, because nothing crossed
 * the boundary. Interest and market movement aren't contributions either — a
 * good month on the markets shouldn't look like a target the user funded.
 */
export function contributionTo(
  transactions: Transaction[],
  accountIds: ReadonlySet<string>,
): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.kind !== "transfer") return sum;
    const into = transaction.toAccountId !== null &&
      accountIds.has(transaction.toAccountId);
    const outOf = accountIds.has(transaction.accountId);
    if (into && !outOf) return sum + transaction.amountCents;
    if (outOf && !into) return sum - transaction.amountCents;
    return sum;
  }, 0);
}

/** Gains minus losses recorded against a group of accounts this month. */
export function growthFor(
  transactions: Transaction[],
  accountIds: ReadonlySet<string>,
): number {
  return transactions.reduce((sum, transaction) => {
    if (!accountIds.has(transaction.accountId)) return sum;
    if (transaction.kind === "gain") return sum + transaction.amountCents;
    if (transaction.kind === "loss") return sum - transaction.amountCents;
    return sum;
  }, 0);
}

/** Every way one account moved this month, for the qualitative account lines. */
export function accountActivity(
  transactions: Transaction[],
  account: Account,
) {
  const ids = new Set([account.id]);
  let incomeCents = 0;
  let expenseCents = 0;

  for (const transaction of transactions) {
    if (transaction.accountId !== account.id) continue;
    if (transaction.kind === "income") incomeCents += transaction.amountCents;
    if (transaction.kind === "expense") expenseCents += transaction.amountCents;
  }

  return {
    contributionCents: contributionTo(transactions, ids),
    growthCents: growthFor(transactions, ids),
    incomeCents,
    expenseCents,
  };
}

/* ── Balances over time ─────────────────────────────────────────────── */

/** The bucket the growth chart plots one point per. */
export type HistoryPeriod = "daily" | "weekly" | "monthly" | "yearly";

export type BalancePoint = {
  /** Start of the bucket this point closes. */
  start: Date;
  /** Exclusive end — the instant these balances were true as of. */
  end: Date;
  /** "Aug 14", "Aug", "2026" — the axis carries whatever the label leaves out. */
  label: string;
  /** The same moment named in full, for the readout line that has the room. */
  caption: string;
  /** Closing balance per account id at the end of that bucket. */
  balances: Deltas;
  totalCents: number;
};

function startOfPeriod(date: Date, period: HistoryPeriod): Date {
  switch (period) {
    case "daily":
      return startOfDay(date);
    case "weekly":
      return startOfWeek(date);
    case "monthly":
      return startOfMonth(date);
    case "yearly":
      return startOfYear(date);
  }
}

function addPeriods(start: Date, period: HistoryPeriod, delta: number): Date {
  switch (period) {
    case "daily":
      return addDays(start, delta);
    case "weekly":
      return addDays(start, delta * 7);
    case "monthly":
      return addMonths(start, delta);
    case "yearly":
      return addYears(start, delta);
  }
}

function labelFor(start: Date, period: HistoryPeriod): string {
  switch (period) {
    case "daily":
    case "weekly":
      return formatDayShort(start);
    case "monthly":
      return formatMonthShort(start);
    case "yearly":
      return String(start.getFullYear());
  }
}

function captionFor(start: Date, period: HistoryPeriod): string {
  switch (period) {
    case "daily":
      return formatDayLong(start);
    case "weekly":
      return `Week of ${formatDayLong(start)}`;
    case "monthly":
      return formatMonthLabel(start);
    case "yearly":
      return String(start.getFullYear());
  }
}

/**
 * What each account was worth at the close of each of the last `count`
 * days, weeks, months or years, ending with the month on screen.
 *
 * Derived by rewinding rather than replaying from the beginning of time: start
 * from the balances we already know, then take each bucket's entries back off
 * to get the bucket before it. That means the periods people actually look at
 * — the recent ones — cost the fewest reads, and the chart can never disagree
 * with the account cards above it, because both come from the same figure.
 */
export function balanceHistory(
  closing: Readonly<Deltas>,
  monthStart: Date,
  ledger: Transaction[],
  period: HistoryPeriod,
  count: number,
): BalancePoint[] {
  // `closing` is what the accounts held when the viewed month ended, so that
  // instant is the only place the rewind can honestly start from.
  const anchorEnd = endOfMonth(monthStart);

  const points: BalancePoint[] = [];
  let balances: Deltas = { ...closing };
  let end = anchorEnd;
  // The newest bucket is the one the anchor falls in, cut short at the anchor:
  // a month ending mid-week must not imply days that haven't happened yet.
  let start = startOfPeriod(new Date(anchorEnd.getTime() - 1), period);

  for (let step = 0; step < count; step += 1) {
    points.push({
      start,
      end,
      label: labelFor(start, period),
      caption: captionFor(start, period),
      balances,
      totalCents: sumBalances(balances),
    });

    const inside = ledger.filter(
      (entry) => entry.date >= start && entry.date < end,
    );
    balances = applyLedger(balances, inside, -1);
    end = start;
    start = addPeriods(start, period, -1);
  }

  return points.reverse();
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
  /**
   * The target as a fraction of the month's income target — what this goal
   * claims of the money coming in. null when no income target is set, since
   * there's then nothing to be a share *of*.
   */
  shareOfIncome: number | null;
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
  return goal.scope === "income" ? "Income" : ACCOUNT_TYPE_LABELS[goal.scope];
}

export function goalIcon(goal: Goal): IconName {
  return goal.scope === "expense"
    ? categoryIcon(goal.categoryId)
    : SCOPE_ICON[goal.scope];
}

function actualFor(
  goal: Goal,
  transactions: Transaction[],
  accounts: Account[],
): number {
  switch (goal.scope) {
    case "income":
      return summariseMonth(transactions).incomeCents;
    case "savings":
    case "investments":
      return contributionTo(transactions, idsOfType(accounts, goal.scope));
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
  accounts: Account[],
  incomeTargetCents: number | null,
): GoalProgress {
  const direction = goalDirection(goal.scope);
  // A withdrawal can push a contribution negative; treated as zero progress
  // rather than a negative bar, which has nothing to mean.
  const actualCents = Math.max(0, actualFor(goal, transactions, accounts));
  const share = goal.amountCents === 0 ? 0 : actualCents / goal.amountCents;

  return {
    goal,
    label: goalLabel(goal),
    icon: goalIcon(goal),
    direction,
    actualCents,
    targetCents: goal.amountCents,
    share,
    // Income is the thing the others are shares of, so it isn't a share of
    // itself — "100% of income" would be noise on every plan ever made.
    shareOfIncome:
      goal.scope === "income" || !incomeTargetCents || incomeTargetCents <= 0
        ? null
        : goal.amountCents / incomeTargetCents,
    ...gradeGoal(direction, share, elapsed),
  };
}

/** Goal order: whatever needs attention first, then by how far along it is. */
const STATUS_RANK: Record<GoalStatus, number> = { bad: 0, watch: 1, good: 2 };

export function allGoalProgress(
  goals: GoalMap,
  transactions: Transaction[],
  elapsed: number,
  accounts: Account[],
): GoalProgress[] {
  const { incomeTargetCents } = allocationOf(goals);

  return Object.values(goals)
    .map((goal) =>
      goalProgress(goal, transactions, elapsed, accounts, incomeTargetCents),
    )
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
