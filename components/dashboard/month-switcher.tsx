"use client";

import { Icon } from "@/components/ui/icon";
import { formatMonthLabel } from "@/lib/budget/format";
import { addMonths, startOfMonth } from "@/lib/budget/use-budget";

/**
 * Which month everything on screen is about, and how to leave it.
 *
 * The way back matters more than the way around: someone reading March can
 * always step forward five times, but nothing on the page tells them how far
 * from today they've walked. So the current month is a named destination that
 * appears only when they aren't on it — which doubles as the signal that they
 * aren't, and is why the arrows alone were never enough.
 */
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
    "flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground";

  return (
    <div className="flex items-center gap-2">
      {/* Left of the arrows, and holding its width even when it has nothing to
          show. Appearing between them shoved the arrows sideways at the exact
          moment someone was clicking one — so the second click of a double
          step landed on the wrong button. */}
      <div className="flex w-[7.5rem] justify-end">
        {isCurrent ? null : (
          <button
            type="button"
            onClick={() => onChange(thisMonth)}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
          >
            <Icon name="undo" className="h-3.5 w-3.5" />
            This month
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          className={arrow}
          aria-label={`Go to ${formatMonthLabel(addMonths(monthStart, -1))}`}
          onClick={() => onChange(addMonths(monthStart, -1))}
        >
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>

        {showLabel ? (
          <span className="min-w-[9.5rem] text-center text-sm font-medium text-foreground">
            {formatMonthLabel(monthStart)}
          </span>
        ) : null}

        <button
          type="button"
          className={arrow}
          // Uncapped, like the back arrow: future months hold entries now —
          // bills dated ahead, a yearly subscription that renews in March — and
          // a user who can write one has to be able to walk to it.
          aria-label={`Go to ${formatMonthLabel(addMonths(monthStart, 1))}`}
          onClick={() => onChange(addMonths(monthStart, 1))}
        >
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
