"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { expensesByCategory } from "@/lib/budget/analytics";
import { formatMoney, formatPercent } from "@/lib/budget/format";
import { SERIES_SLOTS, seriesColor, type Transaction } from "@/lib/budget/types";

/**
 * Where the month's spending went, as a share of the whole.
 *
 * A ring rather than a pie: the hole carries the total, which is the figure
 * every slice is a fraction *of* and otherwise has to be printed somewhere
 * else. Slices are ordered largest-first from twelve o'clock, so rank is read
 * clockwise without comparing angles.
 *
 * Colour is the app's existing categorical order — fixed slots, assigned by
 * rank position and never cycled. Past the eighth the identity channel is
 * exhausted, so the tail folds into one muted "Other" rather than inventing a
 * ninth hue nobody can tell from the first eight. Identity is never carried by
 * colour alone: every slice is named, with its amount, in the legend beside it.
 */

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type Slice = {
  id: string;
  label: string;
  amountCents: number;
  share: number;
  color: string;
  /** Where the slice starts, as a fraction of the ring. */
  offset: number;
};

export function ExpensePie({
  transactions,
  loading,
}: {
  transactions: Transaction[];
  loading: boolean;
}) {
  const [active, setActive] = useState<string | null>(null);
  // Drawn at zero on the first frame and grown to full on the next, so the
  // ring sweeps in rather than appearing. Reduced motion needs no branch: the
  // transition is switched off in CSS, so the same state change lands it fully
  // drawn on that frame.
  const [grown, setGrown] = useState(false);

  const rows = expensesByCategory(transactions);
  const totalCents = rows.reduce((sum, row) => sum + row.amountCents, 0);

  const slices = useMemo<Slice[]>(() => {
    const lead = rows.slice(0, SERIES_SLOTS - 1);
    const tail = rows.slice(SERIES_SLOTS - 1);
    const tailCents = tail.reduce((sum, row) => sum + row.amountCents, 0);

    const combined = [
      ...lead.map((row) => ({
        id: row.categoryId,
        label: row.label,
        amountCents: row.amountCents,
      })),
      ...(tailCents > 0
        ? [
            {
              id: "__other",
              label: `Other (${tail.length} ${tail.length === 1 ? "category" : "categories"})`,
              amountCents: tailCents,
            },
          ]
        : []),
    ];

    let offset = 0;
    return combined.map((row, index) => {
      const share = totalCents === 0 ? 0 : row.amountCents / totalCents;
      const slice: Slice = {
        ...row,
        share,
        color: row.id === "__other" ? "var(--muted)" : seriesColor(index),
        offset,
      };
      offset += share;
      return slice;
    });
  }, [rows, totalCents]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const focused = slices.find((slice) => slice.id === active) ?? null;

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Where it went
        </h3>
        <p className="text-sm text-muted">
          {loading
            ? "Loading this month's spending…"
            : totalCents === 0
              ? "Nothing spent this month."
              : `${formatMoney(totalCents)} across ${rows.length} ${
                  rows.length === 1 ? "category" : "categories"
                }.`}
        </p>
      </div>

      {loading || totalCents === 0 ? null : (
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
          <div className="relative shrink-0">
            <svg
              viewBox="0 0 128 128"
              className="h-36 w-36 -rotate-90"
              role="img"
              aria-label={`Expenses by category, totalling ${formatMoney(totalCents)}`}
            >
              {slices.map((slice) => {
                const dimmed = active !== null && active !== slice.id;
                const length = grown ? slice.share * CIRCUMFERENCE : 0;

                return (
                  <circle
                    key={slice.id}
                    cx="64"
                    cy="64"
                    r={RADIUS}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={dimmed ? 16 : 20}
                    // A gap of surface between neighbours, so two adjacent
                    // slices never read as one continuous arc.
                    strokeDasharray={`${Math.max(0, length - 2)} ${CIRCUMFERENCE}`}
                    strokeDashoffset={-slice.offset * CIRCUMFERENCE}
                    opacity={dimmed ? 0.35 : 1}
                    className="transition-[stroke-dasharray,stroke-width,opacity] duration-700 ease-out motion-reduce:transition-none"
                    onMouseEnter={() => setActive(slice.id)}
                    onMouseLeave={() => setActive(null)}
                  />
                );
              })}
            </svg>

            {/* The total the slices are fractions of, or whichever one the
                pointer is on — the same spot answers both. */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 text-center">
              <span className="text-lg font-semibold tracking-tight text-foreground">
                {formatMoney(focused ? focused.amountCents : totalCents, {
                  compact: true,
                })}
              </span>
              <span className="max-w-[5.5rem] truncate text-xs text-muted">
                {focused ? focused.label : "Total"}
              </span>
            </div>
          </div>

          <ul className="flex min-w-0 flex-1 flex-col gap-1">
            {slices.map((slice) => (
              <li
                key={slice.id}
                onMouseEnter={() => setActive(slice.id)}
                onMouseLeave={() => setActive(null)}
                className={`flex items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors ${
                  active === slice.id ? "bg-surface-muted" : ""
                }`}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {slice.label}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {formatPercent(slice.share)}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(slice.amountCents, { compact: true })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading || totalCents === 0 ? null : (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Icon name="search" className="h-3.5 w-3.5" />
          Hover a slice or a row to single it out.
        </p>
      )}
    </section>
  );
}
