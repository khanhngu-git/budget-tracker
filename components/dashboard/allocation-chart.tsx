"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/budget/format";
import {
  ACCOUNT_KINDS,
  ACCOUNT_LABELS,
  type Account,
  type AccountKind,
} from "@/lib/budget/types";

const SERIES_COLOR: Record<AccountKind, string> = {
  spending: "var(--series-spending)",
  savings: "var(--series-savings)",
  investments: "var(--series-investments)",
};

const RADIUS = 72;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
/** Surface-coloured gap between adjacent segments, in user units (~2px). */
const GAP = 3;

export function AllocationChart({
  accounts,
}: {
  accounts: Record<AccountKind, Account>;
}) {
  const [active, setActive] = useState<AccountKind | null>(null);

  // A pie can't express a negative share, so an overdrawn account contributes
  // nothing to the distribution. Its real balance is still shown in the legend.
  const slices = ACCOUNT_KINDS.map((kind) => ({
    kind,
    balanceCents: accounts[kind].balanceCents,
    shareCents: Math.max(0, accounts[kind].balanceCents),
  }));

  const totalShare = slices.reduce((sum, slice) => sum + slice.shareCents, 0);
  const activeSlice = slices.find((slice) => slice.kind === active) ?? null;
  const netCents = slices.reduce((sum, slice) => sum + slice.balanceCents, 0);

  // Geometry is computed up front rather than accumulated during the JSX map,
  // so nothing is mutated while rendering.
  const segments = slices
    .filter((slice) => slice.shareCents > 0)
    .reduce<
      {
        kind: AccountKind;
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
        kind: slice.kind,
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
                      `${ACCOUNT_LABELS[segment.kind]} ${Math.round(
                        segment.fraction * 100,
                      )} percent`,
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
              const dimmed = active !== null && active !== segment.kind;
              return (
                <circle
                  key={segment.kind}
                  cx="100"
                  cy="100"
                  r={RADIUS}
                  fill="none"
                  stroke={SERIES_COLOR[segment.kind]}
                  strokeWidth={active === segment.kind ? STROKE + 4 : STROKE}
                  strokeDasharray={`${segment.length} ${
                    CIRCUMFERENCE - segment.length
                  }`}
                  strokeDashoffset={segment.offset}
                  opacity={dimmed ? 0.35 : 1}
                  className="cursor-pointer transition-[opacity,stroke-width] duration-150"
                  onMouseEnter={() => setActive(segment.kind)}
                  onMouseLeave={() => setActive(null)}
                >
                  <title>{`${ACCOUNT_LABELS[segment.kind]}: ${formatMoney(
                    segment.balanceCents,
                  )} (${Math.round(segment.fraction * 100)}%)`}</title>
                </circle>
              );
            })}
          </g>
        </svg>

        {/* Centre readout — doubles as the hover tooltip. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <span className="text-xs font-medium uppercase tracking-wide text-muted">
            {activeSlice ? ACCOUNT_LABELS[activeSlice.kind] : "Total"}
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
            {slices.map((slice) => {
              const percent =
                totalShare === 0 ? 0 : (slice.shareCents / totalShare) * 100;
              return (
                <li
                  key={slice.kind}
                  className="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors"
                  style={{
                    backgroundColor:
                      active === slice.kind ? "var(--surface-muted)" : undefined,
                  }}
                  onMouseEnter={() => setActive(slice.kind)}
                  onMouseLeave={() => setActive(null)}
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: SERIES_COLOR[slice.kind] }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                    {ACCOUNT_LABELS[slice.kind]}
                  </span>
                  <span className="text-sm tabular-nums text-muted">
                    {percent.toFixed(0)}%
                  </span>
                  <span className="w-24 text-right text-sm font-medium tabular-nums text-foreground">
                    {formatMoney(slice.balanceCents)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
