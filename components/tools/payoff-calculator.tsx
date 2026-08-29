"use client";

import { useState } from "react";
import { ProjectionChart } from "@/components/tools/projection-chart";
import { MoneyField, PercentField, Stat } from "@/components/tools/fields";
import {
  addMonths,
  formatMonthLabel,
  formatMoney,
  parseBalanceToCents,
} from "@/lib/budget/format";
import { amortise, formatMonths, monthlyRate } from "@/lib/budget/projection";

function toNumber(input: string, fallback = 0): number {
  const value = Number(input.trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Pads a schedule out to a common length so two plans share one x-axis. */
function padded(values: number[], length: number): number[] {
  return Array.from({ length }, (_, index) => values[index] ?? 0);
}

/**
 * Clearing a card or a loan you already have, and what paying extra does.
 *
 * The mirror of the savings calculator, and the same insight from the other
 * side: the useful number is not "how long" but "how much sooner". Card
 * minimums are set so that the answer to the first question is decades, which
 * is exactly why the second one is worth putting on the screen next to it.
 */
export function PayoffCalculator() {
  const [balance, setBalance] = useState("4000");
  const [rate, setRate] = useState("21.9");
  const [payment, setPayment] = useState("200");
  const [extra, setExtra] = useState("50");

  const balanceCents = parseBalanceToCents(balance) ?? 0;
  const annualRate = toNumber(rate) / 100;
  const paymentCents = parseBalanceToCents(payment) ?? 0;
  const extraCents = parseBalanceToCents(extra) ?? 0;

  const plain = amortise(balanceCents, annualRate, paymentCents);
  const boosted = amortise(balanceCents, annualRate, paymentCents + extraCents);

  // The month's interest is what a payment has to beat before a penny of it
  // touches the balance — the difference between a plan and a treadmill.
  const monthlyInterestCents = Math.round(balanceCents * monthlyRate(annualRate));
  const stalls = plain.months === null;

  const monthsSaved =
    plain.months !== null && boosted.months !== null
      ? plain.months - boosted.months
      : 0;
  const interestSaved = stalls
    ? 0
    : plain.interestCents - boosted.interestCents;

  const span = Math.max(
    plain.points.length,
    boosted.points.length,
  );

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Paying off a card or loan
        </h3>
        <p className="text-sm text-muted">
          How long a balance takes to clear at a fixed monthly payment, and how
          much sooner it goes if you add to it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MoneyField
          id="payoff-balance"
          label="Balance owed"
          value={balance}
          onChange={setBalance}
        />
        <PercentField
          id="payoff-rate"
          label="Interest a year"
          hint="The APR on the statement."
          value={rate}
          onChange={setRate}
        />
        <MoneyField
          id="payoff-payment"
          label="Paying each month"
          value={payment}
          onChange={setPayment}
        />
        <MoneyField
          id="payoff-extra"
          label="Extra each month"
          hint="On top of the payment above."
          value={extra}
          onChange={setExtra}
        />
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">
            {boosted.months === null ? "Time to clear" : "Cleared in"}
          </span>
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {boosted.months === null
              ? "Never, at this rate"
              : boosted.months === 0
                ? "Nothing owed"
                : formatMonths(boosted.months)}
          </span>
          {boosted.months !== null && boosted.months > 0 ? (
            <span className="text-sm text-muted">
              That&apos;s {formatMonthLabel(addMonths(new Date(), boosted.months))},
              with a last payment of {formatMoney(boosted.finalPaymentCents)}.
            </span>
          ) : null}
          {boosted.months === null && balanceCents > 0 ? (
            <span className="text-sm text-muted">
              The balance charges {formatMoney(monthlyInterestCents)} of interest
              in the first month alone, so a payment of this size never gets
              past it. Anything above that figure starts clearing the debt.
            </span>
          ) : null}
        </div>

        {boosted.months !== null && boosted.months > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="Total paid" value={formatMoney(boosted.paidCents)} />
            <Stat label="Interest" value={formatMoney(boosted.interestCents)} />
            <Stat
              label={extraCents > 0 ? "The extra saves you" : "Add an extra to see"}
              value={
                extraCents > 0 && monthsSaved > 0
                  ? `${formatMonths(monthsSaved)} · ${formatMoney(interestSaved)}`
                  : "—"
              }
              tone={extraCents > 0 && monthsSaved > 0 ? "positive" : "muted"}
            />
          </div>
        ) : null}
      </div>

      <ProjectionChart
        months={span - 1}
        ariaLabel={
          boosted.months === null
            ? "Balance owed, which the payment never clears."
            : `Balance owed falling to nothing after ${formatMonths(
                boosted.months,
              )}.`
        }
        series={
          extraCents > 0
            ? [
                {
                  id: "boosted",
                  label: "Paying extra",
                  color: "var(--series-1)",
                  values: padded(
                    boosted.points.map((point) => point.balanceCents),
                    span,
                  ),
                },
                {
                  id: "plain",
                  label: "Payment alone",
                  color: "var(--series-2)",
                  values: padded(
                    plain.points.map((point) => point.balanceCents),
                    span,
                  ),
                },
              ]
            : [
                {
                  id: "plain",
                  label: "Still owed",
                  color: "var(--series-1)",
                  fill: true,
                  values: padded(
                    plain.points.map((point) => point.balanceCents),
                    span,
                  ),
                },
              ]
        }
      />
    </div>
  );
}
