"use client";

import { Icon, type IconName } from "@/components/ui/icon";
import { accountActivity } from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import {
  ACCOUNT_BLURBS,
  ACCOUNT_KINDS,
  ACCOUNT_LABELS,
  type Account,
  type AccountKind,
  type Transaction,
} from "@/lib/budget/types";

const SERIES_COLOR: Record<AccountKind, string> = {
  spending: "var(--series-spending)",
  savings: "var(--series-savings)",
  investments: "var(--series-investments)",
};

const ACCOUNT_ICON: Record<AccountKind, IconName> = {
  spending: "wallet",
  savings: "vault",
  investments: "trendUp",
};

/**
 * One line of plain English about what happened to this account in the month
 * being viewed. The balance above it is the number; this is what it means.
 */
function activityLine(kind: AccountKind, transactions: Transaction[]): string {
  const { contributionCents, growthCents, incomeCents, expenseCents } =
    accountActivity(transactions, kind);

  const parts: string[] = [];

  if (kind === "spending") {
    if (incomeCents > 0) parts.push(`${formatMoney(incomeCents)} in`);
    if (expenseCents > 0) parts.push(`${formatMoney(expenseCents)} out`);
    if (contributionCents < 0) {
      parts.push(`${formatMoney(-contributionCents)} moved away`);
    }
  } else {
    if (contributionCents > 0) parts.push(`${formatMoney(contributionCents)} added`);
    if (contributionCents < 0) {
      parts.push(`${formatMoney(-contributionCents)} withdrawn`);
    }
    if (growthCents > 0) parts.push(`${formatMoney(growthCents)} of growth`);
    if (growthCents < 0) parts.push(`${formatMoney(-growthCents)} lost to markets`);
  }

  if (parts.length === 0) return "Untouched this month";
  return `${parts.join(" · ")} this month`;
}

export function AccountCards({
  accounts,
  openingAccounts,
  transactions,
  onAdjust,
}: {
  /** Closing balances for the month on screen. */
  accounts: Record<AccountKind, Account>;
  /** What rolled in from the month before. */
  openingAccounts: Record<AccountKind, Account>;
  transactions: Transaction[];
  onAdjust: (account: AccountKind) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {ACCOUNT_KINDS.map((kind) => {
        const balance = accounts[kind].balanceCents;
        const opening = openingAccounts[kind].balanceCents;
        const change = balance - opening;
        return (
          <article
            key={kind}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  color: SERIES_COLOR[kind],
                  backgroundColor: `color-mix(in oklab, ${SERIES_COLOR[kind]} 14%, var(--surface))`,
                }}
              >
                <Icon name={ACCOUNT_ICON[kind]} className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {ACCOUNT_LABELS[kind]}
                </h3>
                <p className="truncate text-xs text-muted">
                  {ACCOUNT_BLURBS[kind]}
                </p>
              </div>
            </div>

            <p
              className={`text-2xl font-semibold tracking-tight ${
                balance < 0 ? "text-negative" : "text-foreground"
              }`}
            >
              {formatMoney(balance)}
            </p>

            <div className="flex flex-col gap-1">
              {/* The rollover, stated: this month starts where last month
                  finished, and nothing before it can move again. */}
              <p className="truncate text-xs text-muted">
                Rolled over {formatMoney(opening)}
                {change === 0
                  ? " · unchanged"
                  : `, ${change > 0 ? "up" : "down"} ${formatMoney(Math.abs(change))}`}
              </p>
              <p className="truncate text-xs text-muted">
                {activityLine(kind, transactions)}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onAdjust(kind)}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Icon name="pencil" className="h-3.5 w-3.5" />
                Edit balance
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
