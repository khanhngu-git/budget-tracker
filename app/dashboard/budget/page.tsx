"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/dashboard/section";
import { GoalCard } from "@/components/budgets/goal-card";
import { GoalDialog } from "@/components/budgets/goal-dialog";
import { AllocationBar } from "@/components/budgets/allocation-bar";
import {
  allGoalProgress,
  allocationBreakdown,
  monthElapsed,
  rollUpGoals,
} from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { copyGoals, removeGoal } from "@/lib/budget/goals";
import {
  formatMonthLabel,
  formatMoney,
  formatPercent,
  monthKey,
} from "@/lib/budget/format";
import { addMonths } from "@/lib/budget/use-budget";
import { availableScopes } from "@/lib/budget/scopes";
import type { Goal, GoalScope } from "@/lib/budget/types";

// No blurb per group: "Ceilings you'd rather not cross" under a heading that
// already reads "Spending limits" is the same sentence twice.
const GROUPS: { title: string; scopes: GoalScope[] }[] = [
  { title: "Earning", scopes: ["income"] },
  { title: "Building", scopes: ["savings", "investments"] },
  { title: "Paying off", scopes: ["debt"] },
  { title: "Spending limits", scopes: ["expense"] },
];

/**
 * The month's plan.
 *
 * Laid out as one path rather than a grid of equal parts, because a plan is
 * built in an order: what's coming in, then what's promised out of it. An
 * empty month says so in one sentence and offers one button; a month with a
 * plan leads with how much of the income is already spoken for, and only then
 * lists the goals themselves.
 */
export default function BudgetPage() {
  const {
    uid,
    accounts,
    liveAccounts,
    goals,
    settledTransactions,
    loading,
    goalsLoading,
    monthStart,
  } = useBudgetContext();
  const [editing, setEditing] = useState<{ goal: Goal | null; scope?: GoalScope } | null>(
    null,
  );
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const monthLabel = formatMonthLabel(monthStart);
  const previousStart = addMonths(monthStart, -1);
  const key = monthKey(monthStart);

  const progress = allGoalProgress(
    goals,
    settledTransactions,
    monthElapsed(monthStart),
    accounts,
  );
  const rollup = rollUpGoals(progress);
  const busy = loading || goalsLoading;

  const { incomeTargetCents, allocatedCents, unallocatedCents, groups } =
    allocationBreakdown(goals);

  // A scope you have no account for can't be measured, so it isn't offered.
  const scopes = availableScopes(liveAccounts);
  const empty = !busy && rollup.total === 0;

  async function handleRemove(id: string) {
    if (!uid) return;
    setError(null);
    setPendingId(id);
    try {
      await removeGoal(uid, key, id);
      setRemovingId(null);
    } catch {
      setError("Couldn't remove that goal. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  async function handleCopy() {
    if (!uid) return;
    setError(null);
    setNotice(null);
    setCopying(true);
    try {
      const copied = await copyGoals(uid, monthKey(previousStart), key);
      if (copied === 0) {
        setNotice(`${formatMonthLabel(previousStart)} had no plan to copy.`);
      }
    } catch {
      setError("Couldn't copy that plan. Please try again.");
    } finally {
      setCopying(false);
    }
  }

  // Declared once and rendered from both branches below. Living only in the
  // "has a plan" return is what made the empty state's button do nothing.
  const goalDialog =
    uid && editing ? (
      <GoalDialog
        // Remounts per target so the form opens on that goal's own values.
        key={editing.goal?.id ?? editing.scope ?? "new"}
        uid={uid}
        monthKey={key}
        monthLabel={monthLabel}
        goals={goals}
        goal={editing.goal}
        initialScope={editing.scope}
        scopes={scopes}
        open
        onClose={() => setEditing(null)}
      />
    ) : null;

  const errorBanner = error ? (
    <p
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {error}
    </p>
  ) : null;

  /* ── Nothing planned yet ─────────────────────────────────────────── */
  // The whole page becomes one instruction. Competing with a summary panel and
  // three empty group headings is what made "New goal" hard to find at all.
  if (empty) {
    return (
      <>
        {errorBanner}

        <div className="flex flex-col items-center gap-5 rounded-2xl border border-dashed border-border bg-surface px-6 py-14 text-center">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-muted text-muted"
          >
            <Icon name="target" className="h-7 w-7" />
          </span>

          <div className="flex max-w-md flex-col gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              No plan for {monthLabel} yet
            </h2>
            <p className="text-sm text-muted">
              Start with what you expect to earn this month. Everything else —
              what you save, invest, and cap your spending at — is budgeted out
              of that figure, so it comes first.
            </p>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row">
            <Button
              size="md"
              onClick={() => setEditing({ goal: null, scope: "income" })}
              disabled={!uid}
            >
              <Icon name="plus" className="h-4 w-4" />
              Create your monthly budget
            </Button>

            {/* Months are independent by design, which would otherwise mean
                rebuilding the same plan every four weeks. */}
            <Button
              variant="outline"
              size="md"
              onClick={handleCopy}
              disabled={!uid || copying}
            >
              <Icon name="repeat" className="h-4 w-4" />
              {copying
                ? "Copying…"
                : `Copy ${formatMonthLabel(previousStart)}'s plan`}
            </Button>
          </div>

          {notice ? <p className="text-sm text-muted">{notice}</p> : null}
        </div>

        {goalDialog}
      </>
    );
  }

  /* ── A plan in progress ──────────────────────────────────────────── */
  return (
    <>
      <Section
        title={`Your plan for ${monthLabel}`}
        subtitle={busy ? "Loading your plan…" : rollup.headline}
        action={
          <Button
            onClick={() => setEditing({ goal: null })}
            disabled={!uid || busy}
          >
            <Icon name="plus" className="h-4 w-4" />
            New goal
          </Button>
        }
      >
        {/* Income is the ceiling everything else is drawn from, so the plan
            shows how much of this month's income is already promised before it
            shows anything else. */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              Where {monthLabel}&apos;s income is going
            </h3>
            {incomeTargetCents === null ? null : (
              <p className="shrink-0 text-sm tabular-nums text-muted">
                <span className="font-medium text-foreground">
                  {formatMoney(allocatedCents)}
                </span>{" "}
                of {formatMoney(incomeTargetCents)}
                {incomeTargetCents > 0 ? (
                  <>
                    {" · "}
                    <span className="font-medium text-foreground">
                      {formatPercent(allocatedCents / incomeTargetCents)}
                    </span>
                  </>
                ) : null}
              </p>
            )}
          </div>

          {incomeTargetCents === null ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-sm text-muted">
                Savings, investing and every spending limit are budgeted out of
                this month&apos;s income target, so nothing else can be set
                until it is.
              </p>
              <Button
                size="sm"
                onClick={() => setEditing({ goal: null, scope: "income" })}
                disabled={!uid}
              >
                <Icon name="plus" className="h-4 w-4" />
                Create your monthly budget
              </Button>
            </div>
          ) : (
            <>
              <AllocationBar
                groups={groups}
                allocatedCents={allocatedCents}
                unallocatedCents={unallocatedCents}
                incomeTargetCents={incomeTargetCents}
                monthLabel={monthLabel}
              />
              <p className="text-sm text-muted">
                {unallocatedCents > 0
                  ? `${formatMoney(unallocatedCents)} — ${formatPercent(
                      unallocatedCents / incomeTargetCents,
                    )} — of this month's income target is still unallocated.`
                  : unallocatedCents < 0
                    ? `You've promised ${formatMoney(-unallocatedCents)} more than this month's income target. Lower a goal or raise the target.`
                    : "Every cent of this month's income target is allocated."}
              </p>
            </>
          )}
        </div>
      </Section>

      {errorBanner}

      {GROUPS.map((group) => {
        // A group whose every scope is unavailable is dropped whole — an
        // "Building" heading over nothing is a question with no answer.
        const usable = group.scopes.filter((scope) => scopes.has(scope));
        if (usable.length === 0) return null;

        const entries = progress.filter((entry) =>
          usable.includes(entry.goal.scope),
        );
        // Adding straight into the group the user is looking at, rather than
        // making them re-pick the type they just clicked next to.
        const addScope = usable[0];

        return (
          <Section key={group.title} title={group.title}>
            <ul className="flex flex-col gap-3 sm:grid sm:grid-cols-2">
              {entries.map((entry) => (
                <GoalCard
                  key={entry.goal.id}
                  entry={entry}
                  removing={removingId === entry.goal.id}
                  pending={pendingId === entry.goal.id}
                  onEdit={() => setEditing({ goal: entry.goal })}
                  onStartRemove={() => {
                    setError(null);
                    setRemovingId(entry.goal.id);
                  }}
                  onCancelRemove={() => setRemovingId(null)}
                  onConfirmRemove={() => handleRemove(entry.goal.id)}
                />
              ))}

              {/* An add tile sitting in the grid, so the way to extend a group
                  is where the group is — not only in a header button that
                  scrolls off the top. */}
              <li>
                <button
                  type="button"
                  onClick={() => setEditing({ goal: null, scope: addScope })}
                  disabled={!uid || busy}
                  className="flex h-full min-h-[6.5rem] w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm font-medium text-muted transition-colors hover:border-foreground/30 hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-muted"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                  </span>
                  {entries.length === 0
                    ? `Add a ${group.title.toLowerCase()} goal`
                    : "Add another"}
                </button>
              </li>
            </ul>
          </Section>
        );
      })}

      {goalDialog}
    </>
  );
}
