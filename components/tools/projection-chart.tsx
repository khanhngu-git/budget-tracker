"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget/format";
import { formatMonths } from "@/lib/budget/projection";

/* ── Geometry ───────────────────────────────────────────────────────────
   The same fixed viewBox the growth chart uses, so a projection and a history
   sit at the same proportions and the reader's eye doesn't have to re-scale
   between them. */
const WIDTH = 760;
const HEIGHT = 280;
const PAD = { top: 16, right: 16, bottom: 30, left: 64 };
const PLOT_W = WIDTH - PAD.left - PAD.right;
const PLOT_H = HEIGHT - PAD.top - PAD.bottom;

export type ProjectionSeries = {
  id: string;
  label: string;
  /** A palette token — never a raw hex, so both themes are covered. */
  color: string;
  /** One value per month, index 0 being today. */
  values: number[];
  /**
   * Fills to the baseline rather than drawing a line alone.
   *
   * Used for the part of a total that is *inside* another one — money paid in,
   * under a balance — so the gap between the two marks reads as the
   * difference. Drawn under every line, so a fill can never hide one.
   */
  fill?: boolean;
};

/** Nice round gridline values covering [0, max]. */
function ticksFor(max: number, count = 4): number[] {
  if (max <= 0) return [0, 100];

  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rough) ??
    10 * magnitude;

  const ticks: number[] = [];
  for (let value = 0; value <= max + step / 2; value += step) {
    ticks.push(Math.round(value));
  }
  return ticks;
}

/**
 * How the x-axis names a month, given how many are on screen.
 *
 * A two-year plan is read in months and a thirty-year one in years, and
 * labelling either the other way makes the axis unreadable — thirty-six ticks
 * of "Mo 14" or a single tick saying "Yr 1".
 */
function axisLabel(month: number, total: number): string {
  if (month === 0) return "Now";
  if (total <= 36) return `${month}m`;
  return month % 12 === 0 ? `${month / 12}y` : "";
}

/**
 * A projection over months, drawn the same way the dashboard draws history.
 *
 * Deliberately the same shape as a chart of what already happened: one money
 * axis, hairline gridlines, thin marks, and a readout that follows the
 * pointer. The only thing that makes it a projection is that the months are in
 * the future, and the caption is what says so.
 */
export function ProjectionChart({
  series,
  months,
  reference,
  ariaLabel,
}: {
  series: ProjectionSeries[];
  /** How many months the plan runs for — the last index of every series. */
  months: number;
  /**
   * A horizontal line the series are heading for — a savings target.
   *
   * Drawn in ink rather than a hue: it isn't a series, it's the finish line,
   * and giving it a colour of its own would put it in competition with the
   * curves for the reader's identity channel.
   */
  reference?: { valueCents: number; label: string };
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);

  const count = months + 1;
  const highest = Math.max(
    0,
    reference?.valueCents ?? 0,
    ...series.flatMap((entry) => entry.values),
  );
  const ticks = ticksFor(highest);
  const high = ticks[ticks.length - 1];

  const x = (index: number) =>
    PAD.left + (count === 1 ? PLOT_W / 2 : (index / (count - 1)) * PLOT_W);
  const y = (cents: number) =>
    PAD.top + PLOT_H - (cents / (high || 1)) * PLOT_H;

  const path = (values: number[]) =>
    values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(v)}`).join(" ");

  const area = (values: number[]) =>
    `${path(values)} L${x(values.length - 1)} ${y(0)} L${x(0)} ${y(0)} Z`;

  // Ticks thin out from the right, so the end of the plan — the figure the
  // reader came for — always keeps its label.
  const labelEvery = Math.max(1, Math.ceil(count / 10));
  const readAt = active ?? months;

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full touch-none"
          role="img"
          aria-label={ariaLabel}
          onPointerLeave={() => setActive(null)}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const local =
              ((event.clientX - box.left) / box.width) * WIDTH - PAD.left;
            const step = PLOT_W / Math.max(1, count - 1);
            const index = Math.round(local / step);
            setActive(Math.min(count - 1, Math.max(0, index)));
          }}
        >
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

          {Array.from({ length: count }, (_, index) => index).map((index) => {
            const label =
              (count - 1 - index) % labelEvery === 0
                ? axisLabel(index, months)
                : "";
            return label ? (
              <text
                key={index}
                x={x(index)}
                y={HEIGHT - 10}
                textAnchor="middle"
                className="fill-[var(--muted)] text-[11px] tabular-nums"
              >
                {label}
              </text>
            ) : null;
          })}

          {reference ? (
            <g>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y(reference.valueCents)}
                y2={y(reference.valueCents)}
                stroke="var(--foreground)"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                vectorEffect="non-scaling-stroke"
              />
              <text
                x={WIDTH - PAD.right}
                y={y(reference.valueCents) - 6}
                textAnchor="end"
                className="fill-[var(--foreground)] text-[11px] font-medium"
              >
                {reference.label}
              </text>
            </g>
          ) : null}

          {/* Fills first, so a filled series can never sit on top of a line. */}
          {series
            .filter((entry) => entry.fill)
            .map((entry) => (
              <path
                key={`${entry.id}-fill`}
                d={area(entry.values)}
                fill={entry.color}
                fillOpacity={0.16}
              />
            ))}

          {series.map((entry) => (
            <path
              key={entry.id}
              d={path(entry.values)}
              fill="none"
              stroke={entry.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* The crosshair, and a dot per series on it. Ringed in the surface
              colour so two series meeting at the same value stay two dots. */}
          {active === null ? null : (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + PLOT_H}
                stroke="var(--muted)"
                strokeWidth={1}
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
              />
              {series.map((entry) => (
                <circle
                  key={`${entry.id}-dot`}
                  cx={x(active)}
                  cy={y(entry.values[active] ?? 0)}
                  r={4.5}
                  fill={entry.color}
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* The legend doubles as the readout: every series is named in ink with
          its own swatch, and carries the value at wherever the pointer is —
          which is the end of the plan until the pointer says otherwise. */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-muted">
          {readAt === 0
            ? "Today"
            : `After ${formatMonths(readAt)}`}
        </p>
        <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
          {series.map((entry) => (
            <li key={entry.id} className="flex items-center gap-2 text-sm">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted">{entry.label}</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(entry.values[readAt] ?? 0)}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
