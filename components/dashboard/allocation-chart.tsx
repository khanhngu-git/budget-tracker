"use client";

import { useState } from "react";
import { SWEEP_CLASS, sweepStyle, useSweep } from "@/components/ui/ring-sweep";
import { formatMoney, formatPercent } from "@/lib/budget/format";
import { seriesColor, type Account } from "@/lib/budget/types";

const RADIUS = 72;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface-coloured gap between adjacent segments, in user units (~2px). */
const GAP = 3;

export function AllocationChart({ accounts }: { accounts: Account[] }) {
  const [active, setActive] = useState<string | null>(null);

  // One hand sweeping clockwise from twelve o'clock, a segment at a time —
  // the same motion the Statistics ring uses, from the same module.
  const swept = useSweep();

  // A pie can't express a negative share, so an overdrawn account contributes
  // nothing to the distribution. Its real balance is still shown in the legend.
  const slices = accounts.map((account, index) => ({
    id: account.id,
    name: account.name,
    color: seriesColor(index),
    balanceCents: account.balanceCents,
    shareCents: Math.max(0, account.balanceCents),
  }));

  const totalShare = slices.reduce((sum, slice) => sum + slice.shareCents, 0);
  const activeSlice = slices.find((slice) => slice.id === active) ?? null;
  const netCents = slices.reduce((sum, slice) => sum + slice.balanceCents, 0);

  // Geometry is computed up front rather than accumulated during the JSX map,
  // so nothing is mutated while rendering.
  const segments = slices
    .filter((slice) => slice.shareCents > 0)
    .reduce<
      {
        id: string;
        name: string;
        color: string;
        balanceCents: number;
        fraction: number;
        length: number;
        offset: number;
      }[]
    >((acc, slice, _index, source) => {
      const fraction = slice.shareCents / totalShare;
      const full = fraction * CIRCUMFERENCE;
      // Only carve a gap when there's a neighbour to separate from.
      const length = source.length > 1 ? Math.max(full - GAP, 0.5) : full;
      const consumed = acc.reduce((sum, segment) => sum + segment.fraction, 0);

      acc.push({
        id: slice.id,
        name: slice.name,
        color: slice.color,
        balanceCents: slice.balanceCents,
        fraction,
        length,
        offset: -consumed * CIRCUMFERENCE,
      });
      return acc;
    }, []);

  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="relative mx-auto shrink-0">
        <svg
          viewBox="0 0 200 200"
          className="h-44 w-44"
          role="img"
          aria-label={
            totalShare === 0
              ? "Money distribution: no funds yet"
              : `Money distribution across accounts. ${segments
                  .map(
                    (segment) =>
                      `${segment.name} ${Math.round(segment.fraction * 100)} percent`,
                  )
                  .join(", ")}.`
          }
        >
          {/* Track — also the empty state when nothing has been added yet. */}
          <circle
            cx="100"
            cy="100"
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={STROKE}
          />

          <g transform="rotate(-90 100 100)">
            {segments.map((segment) => {
              const dimmed = active !== null && active !== segment.id;
              // Where this segment starts, as a fraction of the whole ring —
              // which is also how long it waits before drawing itself.
              const startsAt = -segment.offset / CIRCUMFERENCE;
              const drawn = swept ? segment.length : 0;

              return (
                <circle
                  key={segment.id}
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={active === segment.id ? STROKE + 4 : STROKE}
                  strokeDasharray={`${drawn} ${CIRCUMFERENCE - drawn}`}
                  strokeDashoffset={segment.offset}
                  opacity={dimmed ? 0.35 : 1}
                  style={sweepStyle(segment.fraction, startsAt)}
                  className={`cursor-pointer ${SWEEP_CLASS}`}
                  onMouseEnter={() => setActive(segment.id)}
                  onMouseLeave={() => setActive(null)}
                >
                  <title>{`${segment.name}: ${formatMoney(
                    segment.balanceCents,
                  )} (${formatPercent(segment.fraction)})`}</title>
                </circle>
              );
            })}
          </g>
        </svg>

        {/* Centre readout — doubles as the hover tooltip. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5 px-8 text-center">
          <span className="w-full truncate text-xs font-medium uppercase tracking-wide text-muted">
            {activeSlice ? activeSlice.name : "Total"}
          </span>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            {formatMoney(activeSlice ? activeSlice.balanceCents : netCents)}
          </span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
          Where your money sits
        </h3>

        {totalShare === 0 ? (
          <p className="text-sm text-muted">
            Add income or a transfer and your distribution will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {slices.map((slice) => (
              <li
                key={slice.id}
                className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
                style={{
                  backgroundColor:
                    active === slice.id ? "var(--surface-muted)" : undefined,
                }}
                onMouseEnter={() => setActive(slice.id)}
                onMouseLeave={() => setActive(null)}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {slice.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-muted">
                  {formatPercent(slice.shareCents / totalShare)}
                </span>
                <span className="w-24 shrink-0 text-right text-sm font-medium tabular-nums text-foreground">
                  {formatMoney(slice.balanceCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
