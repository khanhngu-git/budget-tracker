"use client";

import { useState } from "react";
import { ProjectionChart } from "@/components/tools/projection-chart";
import { CountField, MoneyField, PercentField, Stat } from "@/components/tools/fields";
import { formatMoney, formatPercent, parseBalanceToCents } from "@/lib/budget/format";
import { formatMonths, projectRealValue } from "@/lib/budget/projection";

function toNumber(input: string, fallback = 0): number {
  const value = Number(input.trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const MAX_YEARS = 50;

/**
 * The cost of standing still.
 *
 * Every other tool here answers a question about a decision. This one answers
 * the question about *not* deciding: money left alone loses value on a
 * schedule, and the figure that makes it concrete is not the percentage but
 * the amount — "£10,000 buys £6,100 of what it buys today" is a sentence
 * people act on in a way that "3% a year" is not.
 */
export function InflationCalculator() {
  const [amount, setAmount] = useState("10000");
  const [rate, setRate] = useState("3");
  const [years, setYears] = useState("15");

  const amountCents = parseBalanceToCents(amount) ?? 0;
  const annualInflation = toNumber(rate) / 100;
  const yearCount = Math.min(MAX_YEARS, Math.max(1, Math.round(toNumber(years, 1))));
  const months = yearCount * 12;

  const points = projectRealValue(amountCents, annualInflation, months);
  const last = points[points.length - 1];
  const lostCents = amountCents - last.realCents;
  const lostShare = amountCents > 0 ? lostCents / amountCents : 0;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          What money will be worth
        </h3>
        <p className="text-sm text-muted">
          What an amount left alone will actually buy later, and what the same
          basket of things will cost by then.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyField
          id="inflation-amount"
          label="Amount today"
          value={amount}
          onChange={setAmount}
        />
        <PercentField
          id="inflation-rate"
          label="Inflation a year"
          hint="Long-run averages sit near 2–3%."
          value={rate}
          onChange={setRate}
        />
        <CountField
          id="inflation-years"
          label="In"
          unit="years"
          hint={`Up to ${MAX_YEARS}.`}
          value={years}
          onChange={setYears}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">
            In {formatMonths(months)}, {formatMoney(amountCents)} buys
          </span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatMoney(last.realCents)}
          </span>
          <span className="text-sm text-muted">
            of what it buys today.
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Buying power lost" value={formatMoney(lostCents)} />
          <Stat label="That's a fall of" value={formatPercent(lostShare)} tone="muted" />
          <Stat
            label="Today's basket will cost"
            value={formatMoney(last.nominalCents)}
          />
        </div>
      </div>

      <ProjectionChart
        months={months}
        ariaLabel={`${formatMoney(amountCents)} falling to ${formatMoney(
          last.realCents,
        )} of buying power over ${yearCount} years.`}
        series={[
          {
            id: "real",
            label: "What it buys",
            color: "var(--series-1)",
            fill: true,
            values: points.map((point) => point.realCents),
          },
          {
            id: "nominal",
            label: "What today's basket costs",
            color: "var(--series-2)",
            values: points.map((point) => point.nominalCents),
          },
        ]}
      />
    </div>
  );
}
