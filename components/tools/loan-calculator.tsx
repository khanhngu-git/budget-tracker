"use client";

import { useState } from "react";
import { ProjectionChart } from "@/components/tools/projection-chart";
import { CountField, MoneyField, PercentField, Stat } from "@/components/tools/fields";
import { formatMoney, formatPercent } from "@/lib/budget/format";
import {
  amortise,
  formatMonths,
  levelPayment,
} from "@/lib/budget/projection";

function toNumber(input: string, fallback = 0): number {
  const value = Number(input.trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const MAX_YEARS = 40;

/**
 * What a loan costs, over its own term.
 *
 * The question is asked the way a lender asks it — amount, rate, years — and
 * answered the way a borrower needs it: the monthly payment first, then the
 * total interest, which is the figure the monthly payment is designed to make
 * you stop thinking about. The curve is the balance falling, and its shape is
 * the other half of the story: it barely moves for the first third of a long
 * term, because almost every early payment is interest.
 */
export function LoanCalculator() {
  const [amount, setAmount] = useState("25000");
  const [rate, setRate] = useState("6.5");
  const [years, setYears] = useState("5");

  const principalCents = Math.max(0, Number(amount.trim()) * 100 || 0);
  const annualRate = toNumber(rate) / 100;
  const yearCount = Math.min(MAX_YEARS, Math.max(1, Math.round(toNumber(years, 1))));
  const months = yearCount * 12;

  // Rounded up, not to the nearest cent: a payment a fraction under the exact
  // figure leaves a residue that takes a whole extra month to clear, so the
  // schedule would run to 5 years and 1 month under a headline saying 5 years.
  // Up by a fraction of a cent instead, and the last payment is the short one.
  const paymentCents = Math.ceil(levelPayment(principalCents, annualRate, months));
  const schedule = amortise(principalCents, annualRate, paymentCents);
  const shareInterest =
    schedule.paidCents > 0 ? schedule.interestCents / schedule.paidCents : 0;

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Loan repayments
        </h3>
        <p className="text-sm text-muted">
          The level monthly payment that clears a loan over its term, and what
          the borrowing costs on top of what you borrowed.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyField
          id="loan-amount"
          label="Amount borrowed"
          value={amount}
          onChange={setAmount}
        />
        <PercentField
          id="loan-rate"
          label="Interest a year"
          hint="The rate as quoted, charged monthly."
          value={rate}
          onChange={setRate}
        />
        <CountField
          id="loan-years"
          label="Over"
          unit="years"
          hint={`Up to ${MAX_YEARS}.`}
          value={years}
          onChange={setYears}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">Every month for {formatMonths(months)}</span>
          <span className="text-3xl font-semibold tabular-nums tracking-tight text-foreground">
            {formatMoney(paymentCents)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Stat label="Total paid" value={formatMoney(schedule.paidCents)} />
          <Stat
            label="Interest"
            value={formatMoney(schedule.interestCents)}
            tone={schedule.interestCents > 0 ? "default" : "muted"}
          />
          <Stat
            label="Of what you pay, interest"
            value={formatPercent(shareInterest)}
            tone="muted"
          />
        </div>
      </div>

      <ProjectionChart
        months={schedule.points.length - 1}
        ariaLabel={`Balance owed falling from ${formatMoney(
          principalCents,
        )} to nothing over ${yearCount} years, with ${formatMoney(
          schedule.interestCents,
        )} of interest.`}
        series={[
          {
            id: "owed",
            label: "Still owed",
            color: "var(--series-1)",
            fill: true,
            values: schedule.points.map((point) => point.balanceCents),
          },
          {
            id: "interest",
            label: "Interest so far",
            color: "var(--series-2)",
            values: schedule.points.map((point) => point.interestCents),
          },
        ]}
      />
    </div>
  );
}
