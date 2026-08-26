"use client";

import { useMemo, useState } from "react";
import { balanceHistory, type BalancePoint } from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import type { Deltas } from "@/lib/budget/ledger";
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

export function GrowthChart({
  accounts,
  closingBalances,
  ledger,
  monthStart,
  months,
  loading,
}: {
  /** Accounts in display order — position is what fixes each one's colour. */
  accounts: Account[];
  /** What each account closed the viewed month at. */
  closingBalances: Deltas;
  /** The loaded ledger window, at least `months` deep. */
  ledger: Transaction[];
  monthStart: Date;
  months: number;
  loading: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const points = useMemo(
    () => balanceHistory(closingBalances, monthStart, ledger, months),
    [closingBalances, monthStart, ledger, months],
  );

  const series = useMemo(
    () => seriesFor(accounts, points),
    [accounts, points],
  );

  const everyValue = series.flatMap((entry) => entry.values);
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
  const flat = everyValue.every((value) => value === 0);

  // Month labels thin out so they never collide, counted back from the right:
  // the month on screen is the one the reader came for, so it always keeps its
  // tick and the gaps fall further back in the history.
  const labelEvery = points.length > 8 ? 2 : 1;
  const labelled = (index: number) =>
    (points.length - 1 - index) % labelEvery === 0;
  const readout = active === null ? latest : points[active];

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-1">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          How your accounts have grown
        </h3>
        <p className="text-sm text-muted">
          {loading
            ? "Loading your history…"
            : flat
              ? "Once you've recorded a couple of months, the trend shows up here."
              : `Closing balances month by month. Over these ${points.length} months you're ${
                  change > 0 ? "up" : change < 0 ? "down" : "level at"
                } ${formatMoney(Math.abs(change) || latest.totalCents)}.`}
        </p>
      </div>

      {loading ? null : (
        <>
          <div className="relative">
            <svg
              viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
              className="h-auto w-full touch-none"
              role="img"
              aria-label={`Closing balance for each account from ${earliest.label} to ${latest.label}. Everything: ${formatMoney(
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
                    key={point.monthStart.getTime()}
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

              {series.map((entry) => (
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
                ? series.map((entry) => (
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
            <li className="mb-0.5 text-xs font-medium uppercase tracking-wide text-muted">
              {readout.label} {readout.monthStart.getFullYear()}
            </li>
            {series.map((entry) => (
              <li key={entry.id} className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="h-0.5 w-4 shrink-0 rounded-full"
                  style={{
                    backgroundColor: entry.color,
                    opacity: entry.aggregate ? 0.7 : 1,
                  }}
                />
                <span
                  className={`min-w-0 flex-1 truncate text-sm ${
                    entry.aggregate
                      ? "font-medium text-foreground"
                      : "text-muted"
                  }`}
                >
                  {entry.label}
                </span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(
                    entry.values[active ?? entry.values.length - 1],
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
