"use client";

import { formatMoney, formatPercent } from "@/lib/budget/format";
import { SCOPE_COLORS, type AllocationGroup } from "@/lib/budget/analytics";

/** Enough width that a 1%-of-income goal is still a thing you can see. */
const MIN_SEGMENT = 4;

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}

/**
 * Where the month's income is going, as one bar made of the parts it's going
 * to.
 *
 * Two things are read off it at different distances. Up close it's per goal:
 * each saving, each investment and each spending limit is its own segment,
 * sized by what it claims of the income target. From across the room it's
 * three blocks of colour — the same green, violet and orange those scopes wear
 * everywhere else — so "half of it is spending limits" lands before any label
 * is read at all.
 *
 * The tail is what nobody has promised yet. When there is no tail because the
 * plan is over-committed, the segments simply fill the bar and the sentence
 * underneath says so; a bar that ran off its own edge would be the same
 * information, badly.
 */
export function AllocationBar({
  groups,
  allocatedCents,
  unallocatedCents,
  incomeTargetCents,
  monthLabel,
}: {
  groups: AllocationGroup[];
  allocatedCents: number;
  unallocatedCents: number;
  incomeTargetCents: number;
  monthLabel: string;
}) {
  const segments = groups.flatMap((group) => group.segments);
  const remainder = Math.max(0, unallocatedCents);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="meter"
        aria-label={`Share of ${monthLabel}'s income target already allocated`}
        aria-valuenow={allocatedCents}
        aria-valuemin={0}
        aria-valuemax={incomeTargetCents}
        aria-valuetext={`${formatMoney(allocatedCents)} of ${formatMoney(
          incomeTargetCents,
        )} allocated: ${
          groups
            .map(
              (group) =>
                `${group.label} ${formatMoney(group.amountCents)}`,
            )
            .join(", ") || "nothing yet"
        }`}
        className="flex h-2.5 gap-[2px] overflow-hidden rounded-sm"
        style={{
          backgroundColor:
            "color-mix(in oklab, var(--muted) 16%, var(--surface-muted))",
        }}
      >
        {segments.map((segment) => (
          <div
            key={segment.id}
            className="h-full transition-[flex-grow] duration-200"
            style={{
              flex: `${segment.amountCents} 1 0%`,
              minWidth: MIN_SEGMENT,
              backgroundColor: SCOPE_COLORS[segment.scope],
            }}
            // Native, so the per-goal detail costs no tooltip machinery and
            // still works under a keyboard-driven screen reader via the meter
            // label above.
            title={`${segment.label}: ${formatMoney(segment.amountCents)}${
              segment.share > 0 ? ` (${formatPercent(segment.share)})` : ""
            }`}
          />
        ))}

        {remainder > 0 ? (
          <div
            className="h-full"
            style={{ flex: `${remainder} 1 0%` }}
            title={`Unallocated: ${formatMoney(remainder)}`}
          />
        ) : null}
      </div>

      <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
        {groups.map((group) => (
          <li key={group.scope} className="flex items-center gap-2 text-sm">
            <Swatch color={group.color} />
            <span className="text-muted">{group.label}</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatMoney(group.amountCents)}
            </span>
            {group.share > 0 ? (
              <span className="tabular-nums text-muted">
                {formatPercent(group.share)}
              </span>
            ) : null}
          </li>
        ))}

        {remainder > 0 ? (
          <li className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in oklab, var(--muted) 32%, var(--surface-muted))",
              }}
            />
            <span className="text-muted">Unallocated</span>
            <span className="font-medium tabular-nums text-foreground">
              {formatMoney(remainder)}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  );
}
