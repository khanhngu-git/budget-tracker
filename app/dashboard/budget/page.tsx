"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/dashboard/section";
import { GoalCard } from "@/components/budgets/goal-card";
import { GoalDialog } from "@/components/budgets/goal-dialog";
import {
  allGoalProgress,
  allocationOf,
  monthElapsed,
  rollUpGoals,
} from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { copyGoals, removeGoal } from "@/lib/budget/goals";
import { formatMonthLabel, formatMoney, monthKey } from "@/lib/budget/format";
import { addMonths } from "@/lib/budget/use-budget";
import type { Goal, GoalScope } from "@/lib/budget/types";

const GROUPS: { title: string; blurb: string; scopes: GoalScope[] }[] = [
  {
    title: "Earning",
    blurb: "What you mean to bring in this month.",
    scopes: ["income"],
  },
  {
    title: "Building",
    blurb: "What you move into savings and investments.",
    scopes: ["savings", "investments"],
  },
  {
    title: "Spending limits",
    blurb: "Ceilings you'd rather not cross.",
    scopes: ["expense"],
  },
];

export default function BudgetPage() {
  const { uid, goals, transactions, loading, goalsLoading, monthStart } =
    useBudgetContext();
  const [editing, setEditing] = useState<{ goal: Goal | null } | null>(null);
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
    transactions,
    monthElapsed(monthStart),
  );
  const rollup = rollUpGoals(progress);
  const busy = loading || goalsLoading;

  const { incomeTargetCents, allocatedCents, unallocatedCents } =
    allocationOf(goals);
  const allocatedShare =
    incomeTargetCents && incomeTargetCents > 0
      ? Math.min(1, allocatedCents / incomeTargetCents)
      : 0;

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

  return (
    <>
      <Section
        title={`Your plan for ${monthLabel}`}
        subtitle={
          busy
            ? "Loading your plan…"
            : rollup.total === 0
              ? "Every month has its own plan. Nothing set for this one yet."
              : rollup.headline
        }
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
              </p>
            )}
          </div>

          {incomeTargetCents === null ? (
            <>
              <p className="text-sm text-muted">
                Start with this month&apos;s income target — savings, investing
                and every spending limit are budgeted out of it, so nothing else
                can be set until it is.
              </p>

              {rollup.total === 0 ? (
                <div className="flex flex-wrap items-center gap-3">
                  {/* Months are independent by design, which would otherwise
                      mean rebuilding the same plan every four weeks. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopy}
                    disabled={!uid || copying}
                  >
                    {copying
                      ? "Copying…"
                      : `Copy ${formatMonthLabel(previousStart)}'s plan`}
                  </Button>
                  {notice ? (
                    <span className="text-sm text-muted">{notice}</span>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <>
              <div
                role="meter"
                aria-label={`Share of ${monthLabel}'s income target already allocated`}
                aria-valuenow={allocatedCents}
                aria-valuemin={0}
                aria-valuemax={incomeTargetCents}
                aria-valuetext={`${formatMoney(allocatedCents)} of ${formatMoney(
                  incomeTargetCents,
                )} allocated`}
                className="h-2.5 overflow-hidden rounded-sm"
                style={{
                  backgroundColor:
                    "color-mix(in oklab, var(--accent) 16%, var(--surface-muted))",
                }}
              >
                <div
                  className="h-full rounded-r-[4px] transition-[width] duration-200"
                  style={{
                    width: `${allocatedShare * 100}%`,
                    backgroundColor: "var(--accent)",
                  }}
                />
              </div>
              <p className="text-sm text-muted">
                {unallocatedCents > 0
                  ? `${formatMoney(unallocatedCents)} of this month's income target is still unallocated.`
                  : unallocatedCents < 0
                    ? `You've promised ${formatMoney(-unallocatedCents)} more than this month's income target. Lower a goal or raise the target.`
                    : "Every cent of this month's income target is allocated."}
              </p>
            </>
          )}
        </div>
      </Section>

      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {GROUPS.map((group) => {
        const entries = progress.filter((entry) =>
          group.scopes.includes(entry.goal.scope),
        );

        return (
          <Section key={group.title} title={group.title} subtitle={group.blurb}>
            {entries.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
                {busy ? "Loading…" : "Nothing set here for this month yet."}
              </p>
            ) : (
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
              </ul>
            )}
          </Section>
        );
      })}

      {uid && editing ? (
        <GoalDialog
          // Remounts per target so the form opens on that goal's own values.
          key={editing.goal?.id ?? "new"}
          uid={uid}
          monthKey={key}
          monthLabel={monthLabel}
          goals={goals}
          goal={editing.goal}
          open
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
