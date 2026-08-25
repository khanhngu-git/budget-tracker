"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { expensesByCategory, spendingHeadline } from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import type { Transaction } from "@/lib/budget/types";

/**
 * Expenses by category for one month.
 *
 * The reader's job here is magnitude — "what is eating the money?" — not
 * telling series apart, so every bar wears the same hue and the ranking does
 * the work. Colouring twelve categories individually would spend the identity
 * channel re-encoding what bar length already says, and no twelve-hue set
 * survives colour-vision deficiency anyway.
 */
export function ExpenseChart({
  transactions,
  loading,
}: {
  transactions: Transaction[];
  loading: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);

  const rows = expensesByCategory(transactions);
  // Bars are scaled to the largest category, not to the total, so the
  // comparison between categories stays readable when one dominates.
  const maxCents = rows.length > 0 ? rows[0].amountCents : 0;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Where it went
        </h3>
        <p className="text-sm text-muted">
          {loading ? "Loading this month's spending…" : spendingHeadline(rows)}
        </p>
      </div>

      {loading || rows.length === 0 ? null : (
        <ul className="flex flex-col gap-1">
          {rows.map((row) => {
            const dimmed = active !== null && active !== row.categoryId;
            return (
              <li
                key={row.categoryId}
                className="flex flex-col gap-1.5 rounded-lg px-2 py-2 transition-colors"
                style={{
                  backgroundColor:
                    active === row.categoryId
                      ? "var(--surface-muted)"
                      : undefined,
                }}
                onMouseEnter={() => setActive(row.categoryId)}
                onMouseLeave={() => setActive(null)}
              >
                <div className="flex items-center gap-2.5">
                  <span aria-hidden className="shrink-0 text-muted">
                    <Icon name={row.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {row.label}
                  </span>
                  <span className="shrink-0 text-sm font-medium tabular-nums text-muted">
                    {formatMoney(row.amountCents)}
                  </span>
                </div>

                <div
                  className="h-2 overflow-hidden rounded-sm bg-surface-muted"
                  title={`${row.label}: ${formatMoney(row.amountCents)} (${Math.round(
                    row.share * 100,
                  )}% of expenses)`}
                >
                  <div
                    className="h-full rounded-r-[4px] transition-[opacity,width] duration-150"
                    style={{
                      width: `${maxCents === 0 ? 0 : (row.amountCents / maxCents) * 100}%`,
                      backgroundColor: "var(--series-spending)",
                      opacity: dimmed ? 0.35 : 1,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
