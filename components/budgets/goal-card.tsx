"use client";

import { Icon } from "@/components/ui/icon";
import {
  SCOPE_COLORS,
  type GoalProgress,
  type GoalStatus,
  type SpendScope,
} from "@/lib/budget/analytics";
import { formatMoney, formatPercent } from "@/lib/budget/format";

export const STATUS_COLOR: Record<GoalStatus, string> = {
  good: "var(--positive)",
  watch: "var(--warning)",
  bad: "var(--negative)",
};

const STATUS_TEXT: Record<GoalStatus, string> = {
  good: "text-positive",
  watch: "text-warning",
  bad: "text-negative",
};

/** How the remaining distance reads depends on which way the goal points. */
function remainderLine(entry: GoalProgress): string {
  const difference = entry.targetCents - entry.actualCents;

  if (difference === 0) {
    return entry.direction === "under" ? "Nothing left" : "Exactly on target";
  }
  if (entry.direction === "under") {
    return difference > 0
      ? `${formatMoney(difference)} still available`
      : `${formatMoney(-difference)} past the limit`;
  }
  return difference > 0
    ? `${formatMoney(difference)} to go`
    : `${formatMoney(-difference)} beyond the target`;
}

export function GoalCard({
  entry,
  onEdit,
  onStartRemove,
  onCancelRemove,
  onConfirmRemove,
  removing,
  pending,
}: {
  entry: GoalProgress;
  onEdit: () => void;
  onStartRemove: () => void;
  onCancelRemove: () => void;
  onConfirmRemove: () => void;
  removing: boolean;
  pending: boolean;
}) {
  const color = STATUS_COLOR[entry.status];
  // The stripe is the card's link back to the allocation bar: same colour,
  // same meaning. Status keeps the icon and the meter, because "am I on
  // track" and "which part of the plan is this" are different questions and
  // must not be answered in the same channel. Income has no stripe — it is
  // what the others are allocated out of, not one of them.
  const stripe =
    entry.goal.scope === "income"
      ? null
      : SCOPE_COLORS[entry.goal.scope as SpendScope];

  return (
    <li className="relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-surface p-5">
      {stripe ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: stripe }}
        />
      ) : null}
      <div className="flex items-center gap-2.5">
        <span
          aria-hidden
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{
            color,
            backgroundColor: `color-mix(in oklab, ${color} 14%, var(--surface))`,
          }}
        >
          <Icon name={entry.icon} className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-medium text-foreground">
            {entry.label}
          </h4>
          {/* The status word is the point; the figures sit underneath it. */}
          <p className={`truncate text-xs font-medium ${STATUS_TEXT[entry.status]}`}>
            {entry.summary}
          </p>
        </div>

        {removing ? (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onCancelRemove}
              disabled={pending}
              className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirmRemove}
              disabled={pending}
              className="rounded-md bg-negative px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending ? "Removing…" : "Remove"}
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              onClick={onEdit}
              aria-label={`Edit the ${entry.label} goal`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <Icon name="pencil" className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onStartRemove}
              aria-label={`Remove the ${entry.label} goal`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-negative"
            >
              <Icon name="trash" className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div
        role="meter"
        aria-label={`${entry.label} goal`}
        aria-valuenow={entry.actualCents}
        aria-valuemin={0}
        aria-valuemax={entry.targetCents}
        aria-valuetext={`${formatMoney(entry.actualCents)} of ${formatMoney(
          entry.targetCents,
        )} — ${entry.summary}`}
        className="h-2.5 overflow-hidden rounded-sm"
        style={{
          backgroundColor: `color-mix(in oklab, ${color} 16%, var(--surface-muted))`,
        }}
      >
        <div
          className="h-full rounded-r-[4px] transition-[width] duration-200"
          style={{
            // The bar tops out at full; anything past the target is stated in
            // words rather than by a fill that can't get any longer.
            width: `${Math.min(entry.share, 1) * 100}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-muted">{remainderLine(entry)}</p>
        <p className="shrink-0 text-xs tabular-nums text-muted">
          <span className="font-medium text-foreground">
            {formatMoney(entry.actualCents)}
          </span>{" "}
          / {formatMoney(entry.targetCents)}
          {/* The cost in money answers "how much"; the share of income answers
              "how much of what I earn" — which is the question a plan is
              actually made of, and the one you can compare across months. */}
          {entry.shareOfIncome === null ? null : (
            <>
              {" · "}
              <span className="font-medium text-foreground">
                {formatPercent(entry.shareOfIncome)}
              </span>{" "}
              of income
            </>
          )}
        </p>
      </div>
    </li>
  );
}
