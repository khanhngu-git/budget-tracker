"use client";

import { formatMonthLabel } from "@/lib/budget/format";
import { addMonths } from "@/lib/budget/use-budget";

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
        // Uncapped, like the back arrow: future months hold entries now —
        // bills dated ahead, a yearly subscription that renews in March — and
        // a user who can write one has to be able to walk to it.
        onClick={() => onChange(addMonths(monthStart, 1))}
      >
        <span aria-hidden>›</span>
      </button>
    </div>
  );
}
