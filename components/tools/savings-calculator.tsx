"use client";

import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { ProjectionChart } from "@/components/tools/projection-chart";
import { MoneyField, PercentField, Stat } from "@/components/tools/fields";
import {
  addMonths,
  formatMonthLabel,
  formatMoney,
  parseBalanceToCents,
} from "@/lib/budget/format";
import {
  COMPOUND_FREQUENCIES,
  COMPOUND_FREQUENCY_LABELS,
  formatMonths,
  projectCompound,
  projectSavings,
  type CompoundFrequency,
} from "@/lib/budget/projection";

function toNumber(input: string, fallback = 0): number {
  const value = Number(input.trim());
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

/** Longest plan the chart will draw, so an unreachable target still renders. */
const MAX_PLOT_MONTHS = 480;

/**
 * How long a target takes, and what a lump sum takes off it.
 *
 * The lump sum is the second half of the question, not a footnote to it: "how
 * long?" has an answer people can't act on, and "how much sooner if I put
 * £2,000 in now?" has one they can. So the form asks for both, the headline
 * states the difference in months, and the chart draws the two paths against
 * the same finish line.
 */
export function SavingsCalculator() {
  const [current, setCurrent] = useState("2000");
  const [target, setTarget] = useState("20000");
  const [monthly, setMonthly] = useState("400");
  const [rate, setRate] = useState("3");
  const [lump, setLump] = useState("0");
  const [frequency, setFrequency] = useState<CompoundFrequency>("monthly");

  const currentCents = parseBalanceToCents(current) ?? 0;
  const targetCents = parseBalanceToCents(target) ?? 0;
  const monthlyCents = parseBalanceToCents(monthly) ?? 0;
  const lumpCents = parseBalanceToCents(lump) ?? 0;
  const annualRate = toNumber(rate) / 100;

  // Deliberately not memoised. A run is at most a thousand multiplications,
  // and five of them per keystroke is nothing next to the render they feed —
  // whereas a dependency list over six typed fields is a real source of stale
  // answers, which on a calculator is the only bug that matters.
  const plan = (lumpSumCents: number) =>
    projectSavings({
      currentCents,
      targetCents,
      monthlyCents,
      annualRate,
      frequency,
      lumpSumCents,
    });

  // Run without the lump sum as well as with it: the useful figure is the gap
  // between the two, and it can't be read off either run on its own.
  const plain = plan(0);
  const boosted = plan(lumpCents);

  /**
   * Three lump sums stated as what they are — months of saving, paid up front
   * — rather than as round numbers of money. "Six months' worth in one go"
   * is a decision someone can weigh; "£2,400" is a figure they'd have to work
   * back to the same thought.
   */
  const baseMonths = plain.months;
  const options =
    monthlyCents <= 0 || baseMonths === null
      ? []
      : [3, 6, 12]
          .map((count) => {
            const amountCents = monthlyCents * count;
            const result = plan(amountCents);
            return {
              count,
              amountCents,
              saved:
                result.months === null ? 0 : baseMonths - result.months,
            };
          })
          .filter((option) => option.saved > 0);

  const reached = boosted.months;
  const saved =
    plain.months !== null && reached !== null ? plain.months - reached : 0;

  // Both paths are drawn over the same span — the longer of the two — so the
  // lump sum's head start is visible as a curve arriving earlier rather than
  // as two charts of different widths.
  const span = Math.min(
    MAX_PLOT_MONTHS,
    Math.max(12, (plain.months ?? MAX_PLOT_MONTHS) + 2),
  );

  const path = (openingCents: number) =>
    projectCompound({
      initialCents: openingCents,
      monthlyCents,
      annualRate,
      months: span,
      frequency,
    });

  const plainPoints = path(currentCents);
  const boostedPoints = path(currentCents + lumpCents);

  const headline =
    targetCents <= 0
      ? "Set a target and this fills in."
      : reached === null
        ? "Never, at this rate"
        : reached === 0
          ? "You're already there"
          : formatMonths(reached);

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          How long until I get there
        </h3>
        <p className="text-sm text-muted">
          Months to reach a target at a given monthly rate — and how many of
          them a lump sum today takes off.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MoneyField
          id="savings-current"
          label="Saved so far"
          value={current}
          onChange={setCurrent}
        />
        <MoneyField
          id="savings-target"
          label="Target"
          value={target}
          onChange={setTarget}
        />
        <MoneyField
          id="savings-monthly"
          label="Saving each month"
          value={monthly}
          onChange={setMonthly}
        />
        <MoneyField
          id="savings-lump"
          label="Lump sum today"
          hint="Optional — a bonus, a refund, a windfall."
          value={lump}
          onChange={setLump}
        />
        <PercentField
          id="savings-rate"
          label="Return a year"
          hint="Leave at 0 for a plain savings pot."
          value={rate}
          onChange={setRate}
        />
        <Field label="Compounded" htmlFor="savings-frequency">
          <Select
            id="savings-frequency"
            value={frequency}
            options={COMPOUND_FREQUENCIES.map((option) => ({
              value: option,
              label: COMPOUND_FREQUENCY_LABELS[option],
            }))}
            onChange={(next) => setFrequency(next as CompoundFrequency)}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border bg-surface-muted p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-muted">
            {targetCents > 0 && reached !== null && reached > 0
              ? `You reach ${formatMoney(targetCents)} in`
              : "Time to target"}
          </span>
          <span className="text-3xl font-semibold tracking-tight text-foreground">
            {headline}
          </span>
          {reached !== null && reached > 0 ? (
            <span className="text-sm text-muted">
              That&apos;s {formatMonthLabel(addMonths(new Date(), reached))}.
            </span>
          ) : null}
          {reached === null && targetCents > 0 ? (
            <span className="text-sm text-muted">
              Nothing is being added and nothing is growing, so the balance
              never gets there. Add a monthly amount or a return.
            </span>
          ) : null}
        </div>

        {reached !== null && reached > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label="You put in" value={formatMoney(boosted.paidInCents)} />
            <Stat
              label="Interest earned"
              value={formatMoney(boosted.interestCents)}
              tone={boosted.interestCents > 0 ? "positive" : "muted"}
            />
            <Stat
              label="Lump sum saves you"
              value={saved > 0 ? formatMonths(saved) : "—"}
              tone={saved > 0 ? "positive" : "muted"}
            />
          </div>
        ) : null}
      </div>

      {/* Stated as months of saving because that is the unit the decision is
          made in: "could I find six months' worth?" is answerable in a way
          that a bare amount isn't. */}
      {options.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-foreground">
            What a lump sum would take off
          </p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {options.map((option) => (
              <li
                key={option.count}
                className="flex flex-col gap-0.5 rounded-xl border border-border p-3"
              >
                <span className="text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(option.amountCents)}
                </span>
                <span className="text-xs text-muted">
                  {option.count} months&apos; saving up front
                </span>
                <span className="text-sm font-medium text-positive">
                  {formatMonths(option.saved)} sooner
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <ProjectionChart
        months={span}
        reference={
          targetCents > 0
            ? { valueCents: targetCents, label: "Target" }
            : undefined
        }
        ariaLabel={
          reached === null
            ? "Projected balance, which does not reach the target."
            : `Projected balance reaching ${formatMoney(
                targetCents,
              )} after ${formatMonths(reached)}.`
        }
        series={
          lumpCents > 0
            ? [
                {
                  id: "boosted",
                  label: "With the lump sum",
                  color: "var(--series-1)",
                  values: boostedPoints.map((point) => point.balanceCents),
                },
                {
                  id: "plain",
                  label: "Without it",
                  color: "var(--series-2)",
                  values: plainPoints.map((point) => point.balanceCents),
                },
              ]
            : [
                {
                  id: "plain",
                  label: "Balance",
                  color: "var(--series-1)",
                  fill: true,
                  values: plainPoints.map((point) => point.balanceCents),
                },
              ]
        }
      />
    </div>
  );
}
