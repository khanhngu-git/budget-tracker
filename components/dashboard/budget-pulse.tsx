"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import type { GoalProgress, GoalRollup, GoalStatus } from "@/lib/budget/analytics";

const CHIP_TONE: Record<GoalStatus, string> = {
  good: "border-border text-muted",
  watch: "border-warning/40 text-warning",
  bad: "border-negative/40 text-negative",
};

const HEADLINE_TONE: Record<GoalStatus | "none", string> = {
  good: "text-positive",
  watch: "text-warning",
  bad: "text-negative",
  none: "text-muted",
};

/**
 * Whether the plan is being kept, in one line plus only the goals that need
 * looking at.
 *
 * Listing every goal here would rebuild the Budget page on the dashboard; the
 * point of this strip is that a good month is a single sentence and a bad one
 * shows you exactly which two things went wrong.
 */
export function BudgetPulse({
  rollup,
  loading,
}: {
  rollup: GoalRollup;
  loading: boolean;
}) {
  const attention: GoalProgress[] = rollup.needsAttention.slice(0, 3);
  const hidden = rollup.needsAttention.length - attention.length;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className={`shrink-0 ${HEADLINE_TONE[rollup.status]}`}
          >
            <Icon name="target" className="h-4.5 w-4.5" />
          </span>
          <h3 className="truncate text-[0.9375rem] font-semibold tracking-tight text-foreground">
            Budget check
          </h3>
        </div>

        <Link
          href="/dashboard/budget"
          className="shrink-0 text-sm font-medium text-muted transition-colors hover:text-foreground"
        >
          Open budget
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading your budget…</p>
      ) : rollup.total === 0 ? (
        <p className="text-sm text-muted">
          No plan for this month yet — set what you want to earn, put away and
          stay under, and this tells you how it&apos;s going.
        </p>
      ) : (
        <>
          <p className={`text-sm font-medium ${HEADLINE_TONE[rollup.status]}`}>
            {rollup.headline}
          </p>

          {attention.length === 0 ? (
            <p className="text-sm text-muted">
              Nothing needs your attention this month.
            </p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {attention.map((entry) => (
                <li
                  key={entry.goal.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    CHIP_TONE[entry.status]
                  }`}
                >
                  <Icon name={entry.icon} className="h-3.5 w-3.5" />
                  <span className="text-foreground">{entry.label}</span>
                  <span aria-hidden>·</span>
                  {entry.summary}
                </li>
              ))}
              {hidden > 0 ? (
                <li className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted">
                  +{hidden} more
                </li>
              ) : null}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
