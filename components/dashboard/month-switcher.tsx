"use client";

import { formatMonthLabel } from "@/lib/budget/format";
import { addMonths, startOfMonth } from "@/lib/budget/use-budget";

export function MonthSwitcher({
  monthStart,
  onChange,
  showLabel = true,
}: {
  monthStart: Date;
  onChange: (next: Date) => void;
  /** Off when a heading beside the control already names the month. */
  showLabel?: boolean;
}) {
  const thisMonth = startOfMonth(new Date());
  const isCurrent = monthStart.getTime() === thisMonth.getTime();

  const arrow =
    "flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={arrow}
        aria-label="Previous month"
        onClick={() => onChange(addMonths(monthStart, -1))}
      >
        <span aria-hidden>‹</span>
      </button>
      {showLabel ? (
        <span className="min-w-[9.5rem] text-center text-sm font-medium text-foreground">
          {formatMonthLabel(monthStart)}
        </span>
      ) : null}
      <button
        type="button"
        className={arrow}
        aria-label="Next month"
        // Nothing is recorded in the future, so don't offer empty months.
        disabled={isCurrent}
        onClick={() => onChange(addMonths(monthStart, 1))}
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}
