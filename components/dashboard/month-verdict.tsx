"use client";

import { Icon } from "@/components/ui/icon";
import { monthVerdict, summariseMonth } from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import type { Transaction } from "@/lib/budget/types";

const TONE: Record<string, string> = {
  good: "text-positive",
  watch: "text-warning",
  bad: "text-negative",
  neutral: "text-muted",
};

/**
 * The month in a sentence, with the figures behind it kept deliberately quiet.
 *
 * Three big numbers make a reader do the arithmetic themselves to find out
 * whether the month went well; the sentence answers that first and the numbers
 * are there to back it up.
 */
export function MonthVerdict({
  transactions,
  monthLabel,
}: {
  transactions: Transaction[];
  monthLabel: string;
}) {
  const verdict = monthVerdict(transactions, monthLabel);
  const { incomeCents, expenseCents, netCents } = summariseMonth(transactions);

  const figures = [
    { label: "Came in", value: formatMoney(incomeCents) },
    { label: "Went out", value: formatMoney(expenseCents) },
    {
      label: netCents < 0 ? "Short by" : "Kept",
      value: formatMoney(Math.abs(netCents)),
    },
  ];

  return (
    <section className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6">
      <div className="flex items-start gap-3.5">
        <span
          aria-hidden
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted ${
            TONE[verdict.tone]
          }`}
        >
          <Icon name={verdict.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold tracking-tight text-foreground">
            {verdict.headline}
          </h3>
          <p className="mt-0.5 text-sm text-muted">{verdict.detail}</p>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl bg-border">
        {figures.map((figure) => (
          <div key={figure.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{figure.label}</dt>
            <dd className="mt-0.5 text-sm font-medium tabular-nums text-foreground">
              {figure.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
