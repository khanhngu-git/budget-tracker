"use client";

import { Icon } from "@/components/ui/icon";
import { accountActivity } from "@/lib/budget/analytics";
import { formatMoney } from "@/lib/budget/format";
import {
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  isDebt,
  isEveryday,
  seriesColor,
  type Account,
  type Transaction,
} from "@/lib/budget/types";

/**
 * One line of plain English about what happened to this account in the month
 * being viewed. The balance above it is the number; this is what it means.
 */
function activityLine(account: Account, transactions: Transaction[]): string {
  const { contributionCents, growthCents, incomeCents, expenseCents } =
    accountActivity(transactions, account);

  const parts: string[] = [];

  if (isEveryday(account.type)) {
    if (incomeCents > 0) parts.push(`${formatMoney(incomeCents)} in`);
    if (expenseCents > 0) parts.push(`${formatMoney(expenseCents)} out`);
    if (contributionCents > 0) {
      parts.push(`${formatMoney(contributionCents)} moved in`);
    }
    if (contributionCents < 0) {
      parts.push(`${formatMoney(-contributionCents)} moved away`);
    }
  } else if (isDebt(account.type)) {
    // Every direction reads the opposite way here: money moving *into* a debt
    // account is a repayment, and a gain on it is debt forgiven, not interest
    // earned. Saying "added" would be exactly backwards.
    if (contributionCents > 0) parts.push(`${formatMoney(contributionCents)} repaid`);
    if (contributionCents < 0) {
      parts.push(`${formatMoney(-contributionCents)} drawn down`);
    }
    if (growthCents > 0) parts.push(`${formatMoney(growthCents)} written off`);
    if (growthCents < 0) parts.push(`${formatMoney(-growthCents)} of interest`);
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
  /** Closing balances for the month on screen, in display order. */
  accounts: Account[];
  /** The same accounts, holding what rolled in from the month before. */
  openingAccounts: Account[];
  transactions: Transaction[];
  onAdjust: (account: Account) => void;
}) {
  const opening = new Map(
    openingAccounts.map((account) => [account.id, account.balanceCents]),
  );

  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
        No accounts yet. Add one and your balances start here.
      </p>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {accounts.map((account, index) => {
        const balance = account.balanceCents;
        const opened = opening.get(account.id) ?? 0;
        const change = balance - opened;
        // Colour follows the account's position in the list, so adding a new
        // one never repaints the ones the reader already knows.
        const color = seriesColor(index);
        const owed = isDebt(account.type);

        return (
          <article
            key={account.id}
            className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5"
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{
                  color,
                  backgroundColor: `color-mix(in oklab, ${color} 14%, var(--surface))`,
                }}
              >
                <Icon
                  name={ACCOUNT_TYPE_ICONS[account.type]}
                  className="h-4.5 w-4.5"
                />
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-medium text-foreground">
                  {account.name}
                </h3>
                <p className="truncate text-xs text-muted">
                  {ACCOUNT_TYPE_BLURBS[account.type]}
                </p>
              </div>
            </div>

            {/* A debt is stated as what's owed rather than as a negative
                balance: "−$2,400.00" is arithmetic, "$2,400.00 owed" is the
                thing the reader actually has to deal with. */}
            <p
              className={`text-2xl font-semibold tracking-tight ${
                balance < 0 ? "text-negative" : "text-foreground"
              }`}
            >
              {owed ? formatMoney(Math.abs(balance)) : formatMoney(balance)}
              {owed && balance !== 0 ? (
                <span className="ml-1.5 text-sm font-medium text-muted">
                  owed
                </span>
              ) : null}
            </p>

            <div className="flex flex-col gap-1">
              {/* The rollover, stated: this month starts where last month
                  finished, and nothing before it can move again. */}
              <p className="truncate text-xs text-muted">
                {owed ? "Owed" : "Rolled over"}{" "}
                {formatMoney(owed ? Math.abs(opened) : opened)}
                {change === 0
                  ? " · unchanged"
                  : // On a debt the balance rising *is* the debt falling, so
                    // the direction word is flipped rather than the number.
                    `, ${(owed ? -change : change) > 0 ? "up" : "down"} ${formatMoney(
                      Math.abs(change),
                    )}`}
              </p>
              <p className="truncate text-xs text-muted">
                {activityLine(account, transactions)}
              </p>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onAdjust(account)}
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
