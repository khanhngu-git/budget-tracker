"use client";

import { useMemo, useState } from "react";
import {
  balanceHistory,
  type BalancePoint,
  type HistoryPeriod,
} from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import type { Deltas } from "@/lib/budget/ledger";
import {
  HISTORY_PERIOD_LABELS,
  HISTORY_POINTS,
} from "@/lib/budget/use-budget";
import {
  SERIES_SLOTS,
  seriesColor,
  type Account,
  type Transaction,
} from "@/lib/budget/types";

/* ── Geometry ───────────────────────────────────────────────────────────
   A fixed viewBox scaled to the container: the aspect ratio is preserved, so
   nothing is stretched, and one set of numbers describes the plot at every
   width. */
const WIDTH = 760;
const HEIGHT = 300;
const PAD = { top: 16, right: 16, bottom: 30, left: 64 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

type Series = {
  id: string;
  label: string;
  color: string;
  /** The total is the aggregate of the others, so it isn't a peer of them. */
  aggregate: boolean;
  values: number[];
};

/** Nice round gridline values covering [min, max], always including zero. */
function ticksFor(min: number, max: number, count = 4): number[] {
  const lo = Math.min(0, min);
  const hi = Math.max(0, max);
  if (hi === lo) return [0, 100];

  const rough = (hi - lo) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude;

  const start = Math.floor(lo / step) * step;
  const end = Math.ceil(hi / step) * step;

  const ticks: number[] = [];
  for (let value = start; value <= end + step / 2; value += step) {
    ticks.push(Math.round(value));
  }
  return ticks;
}

/**
 * Accounts as chart series, capped at the eight hues the palette can tell
 * apart. Past that the identity channel is spent, so the remainder folds into
 * one muted "Other accounts" line rather than inventing a ninth colour no
 * reader could match to a legend.
 */
function seriesFor(accounts: Account[], points: BalancePoint[]): Series[] {
  const at = (balances: Deltas, id: string) => balances[id] ?? 0;

  const named = accounts.slice(0, SERIES_SLOTS).map((account, index) => ({
    id: account.id,
    label: account.name,
    color: seriesColor(index),
    aggregate: false,
    values: points.map((point) => at(point.balances, account.id)),
  }));

  const rest = accounts.slice(SERIES_SLOTS);
  if (rest.length > 0) {
    named.push({
      id: "__other",
      label: `${rest.length} other accounts`,
      color: "var(--muted)",
      aggregate: false,
      values: points.map((point) =>
        rest.reduce((sum, account) => sum + at(point.balances, account.id), 0),
      ),
    });
  }

  return [
    {
      id: "__total",
      label: "Everything",
      // The sum wears ink, not a hue: it isn't one more account competing for
      // identity, it's the line the others add up to.
      color: "var(--foreground)",
      aggregate: true,
      values: points.map((point) => point.totalCents),
    },
    ...named,
  ];
}

const PERIODS = Object.keys(HISTORY_PERIOD_LABELS) as HistoryPeriod[];

/** How the subtitle names the span the reader is looking at. */
const SPAN_NOUN: Record<HistoryPeriod, string> = {
  daily: "days",
  weekly: "weeks",
  monthly: "months",
  yearly: "years",
};

/** What each point is a closing balance *of*. */
const POINT_NOUN: Record<HistoryPeriod, string> = {
  daily: "Closing balances day by day",
  weekly: "Closing balances week by week",
  monthly: "Closing balances month by month",
  yearly: "Closing balances year by year",
};

export function GrowthChart({
  accounts,
  closingBalances,
  ledger,
  monthStart,
  period,
  onPeriodChange,
  loading,
}: {
  /** Accounts in display order — position is what fixes each one's colour. */
  accounts: Account[];
  /** What each account closed the viewed month at. */
  closingBalances: Deltas;
  /** The loaded ledger window, deep enough to cover `period`. */
  ledger: Transaction[];
  monthStart: Date;
  period: HistoryPeriod;
  /** Lifted, because the choice decides how much ledger has to be loaded. */
  onPeriodChange: (next: HistoryPeriod) => void;
  loading: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);
  // Hidden rather than removed: a series keeps its slot and its colour while
  // it's off, so toggling it back on doesn't repaint the ones still showing.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(new Set());

  const points = useMemo(
    () =>
      balanceHistory(
        closingBalances,
        monthStart,
        ledger,
        period,
        HISTORY_POINTS[period],
      ),
    [closingBalances, monthStart, ledger, period],
  );

  const series = useMemo(
    () => seriesFor(accounts, points),
    [accounts, points],
  );

  const shown = series.filter((entry) => !hidden.has(entry.id));

  function toggle(id: string) {
    setHidden((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  // The axis follows what's on screen. Scaling to the hidden series too would
  // make hiding the total pointless — the whole reason to drop it is to get a
  // scale the smaller accounts can actually be read against.
  const everyValue = shown.flatMap((entry) => entry.values);
  const ticks = ticksFor(Math.min(...everyValue, 0), Math.max(...everyValue, 0));
  const low = ticks[0];
  const high = ticks[ticks.length - 1];

  const x = (index: number) =>
    PAD.left +
    (points.length === 1 ? PLOT_W / 2 : (index / (points.length - 1)) * PLOT_W);
  const y = (cents: number) =>
    PAD.top + PLOT_H - ((cents - low) / (high - low || 1)) * PLOT_H;

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ");

  const latest = points[points.length - 1];
  const earliest = points[0];
  const change = latest.totalCents - earliest.totalCents;
  const flat = series
    .flatMap((entry) => entry.values)
    .every((value) => value === 0);

  // Axis labels thin out so they never collide, counted back from the right:
  // the period on screen is the one the reader came for, so it always keeps
  // its tick and the gaps fall further back in the history.
  const labelEvery = Math.ceil(points.length / 8);
  const labelled = (index: number) =>
    (points.length - 1 - index) % labelEvery === 0;
  const readout = active === null ? latest : points[active];

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
            How your accounts have grown
          </h3>
          <p className="text-sm text-muted">
            {loading
              ? "Loading your history…"
              : flat
                ? "Once you've recorded a couple of entries, the trend shows up here."
                : `${POINT_NOUN[period]}. Over these ${points.length} ${
                    SPAN_NOUN[period]
                  } you're ${
                    change > 0 ? "up" : change < 0 ? "down" : "level at"
                  } ${formatMoney(Math.abs(change) || latest.totalCents)}.`}
          </p>
        </div>

        {/* One row of periods rather than a select: there are only four, and
            seeing which others exist is half of why anyone changes it. */}
        <div
          role="group"
          aria-label="Time period"
          className="flex shrink-0 gap-0.5 rounded-lg border border-border bg-surface-muted p-0.5"
        >
          {PERIODS.map((option) => {
            const selected = option === period;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onPeriodChange(option)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  selected
                    ? "bg-surface text-foreground shadow-sm"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {HISTORY_PERIOD_LABELS[option]}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? null : (
        <>
          <div className="relative">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full touch-none"
              role="img"
              aria-label={`Closing balance for each account from ${earliest.caption} to ${latest.caption}. Everything: ${formatMoney(
                latest.totalCents,
              )}.`}
              onPointerLeave={() => setActive(null)}
              onPointerMove={(event) => {
                const box = event.currentTarget.getBoundingClientRect();
                const local =
                  ((event.clientX - box.left) / box.width) * WIDTH - PAD.left;
                const step = PLOT_W / Math.max(1, points.length - 1);
                const index = Math.round(local / step);
                setActive(Math.min(points.length - 1, Math.max(0, index)));
              }}
            >
              {/* Gridlines: hairline, one step off the surface, recessive. */}
              {ticks.map((tick) => (
                <g key={tick}>
                  <line
                    x1={PAD.left}
                    x2={WIDTH - PAD.right}
                    y1={y(tick)}
                    y2={y(tick)}
                    stroke="var(--border)"
                    strokeWidth={1}
                    vectorEffect="non-scaling-stroke"
                  />
                  <text
                    x={PAD.left - 10}
                    y={y(tick) + 4}
                    textAnchor="end"
                    className="fill-[var(--muted)] text-[11px] tabular-nums"
                  >
                    {formatMoney(tick, { compact: true })}
                  </text>
                </g>
              ))}

              {points.map((point, index) =>
                labelled(index) ? (
                  <text
                    key={point.start.getTime()}
                    x={x(index)}
                    y={HEIGHT - 10}
                    textAnchor="middle"
                    className="fill-[var(--muted)] text-[11px]"
                  >
                    {point.label}
                  </text>
                ) : null,
              )}

              {/* Crosshair: readers aim at a month, never at a 2px line. */}
              {active !== null ? (
                <line
                  x1={x(active)}
                  x2={x(active)}
                  y1={PAD.top}
                  y2={PAD.top + PLOT_H}
                  stroke="var(--muted)"
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
              ) : null}

              {shown.map((entry) => (
                <path
                  key={entry.id}
                  d={path(entry.values)}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={entry.aggregate ? "6 4" : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              ))}

              {/* Markers on the hovered month only — a dot on every point on
                  every line would bury the lines themselves. The surface ring
                  keeps two coincident dots legible where accounts cross. */}
              {active !== null
                ? shown.map((entry) => (
                    <circle
                      key={entry.id}
                      cx={x(active)}
                      cy={y(entry.values[active])}
                      r={4.5}
                      fill={entry.color}
                      stroke="var(--surface)"
                      strokeWidth={2}
                      vectorEffect="non-scaling-stroke"
                    />
                  ))
                : null}
            </svg>
          </div>

          {/* Legend, always present, carrying each series' value for the month
              in view — identity is never colour alone, and the figures stay
              readable without hovering. */}
          <ul className="flex flex-col gap-1.5 border-t border-border pt-4">
            <li className="mb-0.5 flex items-baseline justify-between gap-3 px-1">
              <span className="text-xs font-medium uppercase tracking-wide text-muted">
                {readout.caption}
              </span>
              <span className="text-xs text-muted">Tap a row to hide it</span>
            </li>
            {series.map((entry) => {
              const off = hidden.has(entry.id);
              return (
                <li key={entry.id}>
                  {/* The legend is the control: the thing naming a line is the
                      obvious place to click to hide it, and it keeps the
                      figures reachable either way. */}
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-pressed={!off}
                    className="flex w-full items-center gap-3 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-surface-muted"
                  >
                    <span
                      aria-hidden
                      className="h-0.5 w-4 shrink-0 rounded-full"
                      style={{
                        backgroundColor: off ? "var(--border)" : entry.color,
                        opacity: entry.aggregate && !off ? 0.7 : 1,
                      }}
                    />
                    <span
                      className={`min-w-0 flex-1 truncate text-sm ${
                        off
                          ? "text-muted line-through decoration-muted/70"
                          : entry.aggregate
                            ? "font-medium text-foreground"
                            : "text-muted"
                      }`}
                    >
                      {entry.label}
                    </span>
                    <span
                      className={`shrink-0 text-sm font-medium tabular-nums ${
                        off ? "text-muted/60" : "text-foreground"
                      }`}
                    >
                      {formatMoney(
                        entry.values[active ?? entry.values.length - 1],
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
