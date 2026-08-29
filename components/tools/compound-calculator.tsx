"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/select";
import { Field } from "@/components/ui/field";
import { ProjectionChart } from "@/components/tools/projection-chart";
import { CountField, MoneyField, PercentField, Stat } from "@/components/tools/fields";
import { formatMoney, formatPercent, parseBalanceToCents } from "@/lib/budget/format";
import {
  COMPOUND_FREQUENCIES,
  COMPOUND_FREQUENCY_LABELS,
  formatMonths,
  projectCompound,
  type CompoundFrequency,
} from "@/lib/budget/projection";

/** A number typed into a box, or a fallback if it isn't one yet. */
function toNumber(input: string, fallback = 0): number {
  const value = Number(input.trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const MAX_YEARS = 60;

/**
 * What a balance becomes if it's left alone and added to.
 *
 * Two marks, not one: the balance, and — underneath it — everything actually
 * paid in. The gap between them is the whole point of compounding, and it is
 * the only way to show it that doesn't ask the reader to subtract two figures
 * in their head. The headline still states it in words, because a shape is not
 * a number.
 */
export function CompoundCalculator() {
  const [initial, setInitial] = useState("1000");
  const [monthly, setMonthly] = useState("200");
  const [rate, setRate] = useState("6");
  const [years, setYears] = useState("20");
  const [frequency, setFrequency] = useState<CompoundFrequency>("monthly");

  const yearCount = Math.min(MAX_YEARS, Math.max(1, Math.round(toNumber(years, 1))));
  const months = yearCount * 12;

  const points = useMemo(
    () =>
      projectCompound({
        initialCents: parseBalanceToCents(initial) ?? 0,
        monthlyCents: parseBalanceToCents(monthly) ?? 0,
        annualRate: toNumber(rate) / 100,
        months,
        frequency,
      }),
    [initial, monthly, rate, months, frequency],
  );

  const last = points[points.length - 1];
  const paidIn = last.contributedCents;
  const interest = last.interestCents;
  // What proportion of the end balance nobody had to earn. Zero-safe, because
  // a rate of 0% is a perfectly reasonable thing to type.
  const fromInterest =
    last.balanceCents > 0 ? interest / last.balanceCents : 0;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Compound interest
        </h3>
        <p className="text-sm text-muted">
          What a balance grows to when the returns are left in to earn returns
          of their own. Contributions land at the end of each month.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          id="compound-initial"
          label="Starting amount"
          value={initial}
          onChange={setInitial}
        />
        <MoneyField
          id="compound-monthly"
          label="Added each month"
          value={monthly}
          onChange={setMonthly}
        />
        <PercentField
          id="compound-rate"
          label="Return a year"
          hint="Before tax and inflation."
          value={rate}
          onChange={setRate}
        />
        <CountField
          id="compound-years"
          label="For"
          unit="years"
          hint={`Up to ${MAX_YEARS}.`}
          value={years}
          onChange={setYears}
        />
        <Field label="Compounded" htmlFor="compound-frequency">
          <Select
            id="compound-frequency"
            value={frequency}
            options={COMPOUND_FREQUENCIES.map((option) => ({
              value: option,
              label: COMPOUND_FREQUENCY_LABELS[option],
            }))}
            onChange={(next) => setFrequency(next as CompoundFrequency)}
          />
        </Field>
      </div>

      {/* The answer, in words, before the chart that shows how it got there. */}
      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">
            After {formatMonths(months)}
          </span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatMoney(last.balanceCents)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="You put in" value={formatMoney(paidIn)} />
          <Stat
            label="Interest earned"
            value={formatMoney(interest)}
            tone={interest > 0 ? "positive" : "muted"}
          />
          <Stat
            label="Of the total, earned"
            value={formatPercent(fromInterest)}
            tone="muted"
          />
        </div>
      </div>

      <ProjectionChart
        months={months}
        ariaLabel={`Projected balance over ${yearCount} years, ending at ${formatMoney(
          last.balanceCents,
        )}, of which ${formatMoney(paidIn)} was paid in.`}
        series={[
          {
            id: "balance",
            label: "Balance",
            color: "var(--series-1)",
            values: points.map((point) => point.balanceCents),
          },
          {
            id: "paid-in",
            label: "You put in",
            color: "var(--series-2)",
            fill: true,
            values: points.map((point) => point.contributedCents),
          },
        ]}
      />
    </div>
  );
}
