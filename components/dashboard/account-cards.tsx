"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { AnimatedMoney } from "@/components/ui/animated-money";
import { accountActivity } from "@/lib/budget/analytics";
import {
  MAX_ACCOUNT_NAME,
  deleteAccount,
  renameAccount,
  setAccountTarget,
} from "@/lib/budget/accounts";
import { setAccountBalances } from "@/lib/budget/transactions";
import { parseSignedBalanceToCents } from "@/lib/budget/format";
import {
  formatMoney,
  formatPercent,
  parseAmountToCents,
} from "@/lib/budget/format";
import {
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  canHoldTarget,
  isDebt,
  isEveryday,
  seriesColor,
  targetProgress,
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

/**
 * Everything the card can be doing other than sitting still.
 *
 * Name and balance are one mode, not two. They are the two things about an
 * account you correct, they sit two lines apart, and splitting them meant
 * fixing a typo and a figure was two separate round trips through a pencil.
 */
type Editing =
  | {
      kind: "account";
      id: string;
      name: string;
      balance: string;
      confirmingRemove: boolean;
    }
  | { kind: "target"; id: string; value: string }
  | null;

export function AccountCards({
  uid,
  accounts,
  openingAccounts,
  transactions,
  onAdjust,
  onQuickAdd,
}: {
  uid: string | null;
  /** Closing balances for the month on screen, in display order. */
  accounts: Account[];
  /** The same accounts, holding what rolled in from the month before. */
  openingAccounts: Account[];
  transactions: Transaction[];
  /** Opens the fuller balance dialog, for a dated, noted adjustment. */
  onAdjust: (account: Account) => void;
  /** Starts a new entry already pointed at this account. */
  onQuickAdd: (account: Account) => void;
}) {
  const opening = new Map(
    openingAccounts.map((account) => [account.id, account.balanceCents]),
  );
  // Renaming and setting a target are one field each. A dialog for either was
  // three clicks and a context switch to change one word, so both are edited
  // in place — the card keeps its position and the rest of the page stays put.
  const [editing, setEditing] = useState<Editing>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (accounts.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
        No accounts yet. Add one and your balances start here.
      </p>
    );
  }

  async function commit(account: Account) {
    if (!uid || !editing) return;
    setError(null);
    setPending(true);
    try {
      if (editing.kind === "account") {
        if (editing.name.trim() !== account.name) {
          await renameAccount(uid, account.id, editing.name);
        }

        // Typed as a plain positive figure for a debt, the way a statement
        // prints it, and stored as the negative balance it really is.
        const typed = parseSignedBalanceToCents(editing.balance);
        if (typed === null) {
          setError("Enter a balance like 1250.00.");
          setPending(false);
          return;
        }
        const target = isDebt(account.type) ? -Math.abs(typed) : typed;
        if (target !== account.balanceCents) {
          // Routed through the same call the balance dialog uses, so the
          // difference lands in the ledger as a gain or loss rather than
          // silently rewriting a number.
          await setAccountBalances(
            uid,
            { [account.id]: target },
            { note: "Balance correction", date: new Date() },
          );
        }
      } else {
        const trimmed = editing.value.trim();
        // An emptied field is how you clear a target — there is no separate
        // "remove" to hunt for.
        const cents = trimmed === "" ? null : parseAmountToCents(trimmed);
        if (trimmed !== "" && cents === null) {
          setError("Enter a target like 15000.00.");
          setPending(false);
          return;
        }
        await setAccountTarget(uid, account.id, cents);
      }
      setEditing(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't save that change.",
      );
    } finally {
      setPending(false);
    }
  }

  /**
   * Removal, refused by the model unless the account is empty and unused —
   * the error explains which, so it is surfaced rather than swallowed.
   */
  async function remove(account: Account) {
    if (!uid) return;
    setError(null);
    setPending(true);
    try {
      await deleteAccount(uid, account.id);
      setEditing(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Couldn't remove that account.",
      );
    } finally {
      setPending(false);
    }
  }

  function onFieldKeyDown(event: React.KeyboardEvent, account: Account) {
    if (event.key === "Enter") {
      event.preventDefault();
      void commit(account);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(null);
      setError(null);
    }
  }

  const chip =
    "relative z-10 inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60";

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
        const share = targetProgress(account);

        const renaming = editing?.kind === "account" && editing.id === account.id;
        const retargeting =
          editing?.kind === "target" && editing.id === account.id;
        const busy = pending && (renaming || retargeting);

        return (
          <article
            key={account.id}
            className="relative flex flex-col gap-3 rounded-2xl border border-border bg-surface p-5 transition-colors focus-within:border-foreground/30 hover:border-foreground/30"
          >
            {/* A stretched link rather than a wrapping anchor: the card holds
                buttons, and nesting those inside a link is invalid and breaks
                keyboard use. This covers the card's dead space and sits below
                every control, which carries its own z-index. */}
            {renaming || retargeting ? null : (
              <Link
                href={`/dashboard/transactions?account=${account.id}`}
                className="absolute inset-0 z-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <span className="sr-only">
                  See {account.name} entries in Transactions
                </span>
              </Link>
            )}

            <div className="relative z-10 flex items-center gap-2.5">
              <span
                aria-hidden
                className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-lg"
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

              <div className="pointer-events-none min-w-0 flex-1">
                {renaming ? (
                  <input
                    autoFocus
                    value={editing.name}
                    maxLength={MAX_ACCOUNT_NAME}
                    disabled={busy}
                    aria-label={`Rename ${account.name}`}
                    onChange={(event) =>
                      setEditing({ ...editing, name: event.target.value })
                    }
                    onKeyDown={(event) => onFieldKeyDown(event, account)}
                    className="pointer-events-auto relative z-10 h-7 w-full rounded-md border border-border bg-surface px-2 text-sm font-medium text-foreground"
                  />
                ) : (
                  <h3 className="truncate text-sm font-medium text-foreground">
                    {account.name}
                  </h3>
                )}
                <p className="truncate text-xs text-muted">
                  {ACCOUNT_TYPE_BLURBS[account.type]}
                </p>
              </div>

              {/* One control that changes meaning: pencil to edit, tick to
                  confirm. Two buttons in the same corner, one of which is only
                  ever valid half the time, is how you get people confirming an
                  edit they hadn't started. */}
              <button
                type="button"
                aria-label={
                  renaming ? `Save changes to ${account.name}` : `Edit ${account.name}`
                }
                onClick={() =>
                  renaming
                    ? void commit(account)
                    : setEditing({
                        kind: "account",
                        id: account.id,
                        name: account.name,
                        balance: (
                          Math.abs(account.balanceCents) / 100
                        ).toFixed(2),
                        confirmingRemove: false,
                      })
                }
                disabled={!uid || busy || retargeting}
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-40 ${
                  renaming
                    ? "bg-foreground text-background"
                    : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                <Icon name={renaming ? "check" : "pencil"} className="h-3.5 w-3.5" />
              </button>
            </div>

            {renaming ? (
              <div className="relative z-10 flex flex-col gap-1">
                <label
                  htmlFor={`balance-${account.id}`}
                  className="text-xs font-medium text-muted"
                >
                  {owed ? "Amount owed" : "Balance"}
                </label>
                <input
                  id={`balance-${account.id}`}
                  inputMode="decimal"
                  value={editing.balance}
                  disabled={busy}
                  onChange={(event) =>
                    setEditing({ ...editing, balance: event.target.value })
                  }
                  onKeyDown={(event) => onFieldKeyDown(event, account)}
                  className="h-10 w-full rounded-lg border border-border bg-surface px-2 text-xl font-semibold tracking-tight text-foreground"
                />
                <p className="text-xs text-muted">
                  The difference is recorded as a gain or a loss, dated today.{" "}
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      onAdjust(account);
                    }}
                    className="font-medium text-foreground underline underline-offset-2"
                  >
                    Add a date or note
                  </button>
                </p>
              </div>
            ) : (
              /* A debt is stated as what's owed rather than as a negative
                 balance: "−$2,400.00" is arithmetic, "$2,400.00 owed" is the
                 thing the reader actually has to deal with. */
              <p
                className={`pointer-events-none text-2xl font-semibold tracking-tight ${
                  balance < 0 ? "text-negative" : "text-foreground"
                }`}
              >
                <AnimatedMoney cents={owed ? Math.abs(balance) : balance} />
                {owed && balance !== 0 ? (
                  <span className="ml-1.5 text-sm font-medium text-muted">
                    owed
                  </span>
                ) : null}
              </p>
            )}

            {/* What you're saving up to, and how far along you are. Measured
                against the balance rather than this month's movement, because
                a target spans months — that's what makes it a target and not
                a goal. */}
            {retargeting ? (
              <div className="relative z-10 flex flex-col gap-1.5">
                <label
                  htmlFor={`target-${account.id}`}
                  className="text-xs font-medium text-foreground"
                >
                  Saving up to
                </label>
                <input
                  id={`target-${account.id}`}
                  autoFocus
                  inputMode="decimal"
                  placeholder="15000.00"
                  value={editing.value}
                  disabled={busy}
                  onChange={(event) =>
                    setEditing({ ...editing, value: event.target.value })
                  }
                  onKeyDown={(event) => onFieldKeyDown(event, account)}
                  className="h-8 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void commit(account)}
                    disabled={busy}
                    className="inline-flex h-7 items-center rounded-md bg-foreground px-2.5 text-xs font-medium text-background disabled:opacity-60"
                  >
                    {busy ? "Saving…" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(null);
                      setError(null);
                    }}
                    className="text-xs font-medium text-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <span className="text-xs text-muted">
                    Empty clears the target
                  </span>
                </div>
              </div>
            ) : share !== null && account.targetCents ? (
              <div className="pointer-events-none flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted">
                    Target {formatMoney(account.targetCents)}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatPercent(share)}
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(share * 100)}
                  aria-label={`Progress toward the ${account.name} target`}
                  className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted"
                >
                  <div
                    className="h-full rounded-full transition-[width]"
                    style={{ width: `${share * 100}%`, backgroundColor: color }}
                  />
                </div>
                <p className="truncate text-xs text-muted">
                  {balance >= account.targetCents
                    ? "Target reached"
                    : `${formatMoney(account.targetCents - balance)} to go`}
                </p>
              </div>
            ) : null}

            <div className="pointer-events-none flex flex-col gap-1">
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

            {error && (renaming || retargeting) ? (
              <p role="alert" className="relative z-10 text-xs text-negative">
                {error}
              </p>
            ) : null}

            {/* Pinned to the bottom of the card rather than trailing the
                content: the grid stretches every card to the tallest in its
                row, so one account gaining a target bar left every other
                card's actions hanging halfway up. `mt-auto` eats the slack. */}
            <div className="mt-auto flex flex-wrap items-center justify-end gap-1 pt-1">
              {/* The confirmation stays inside the card and wraps rather than
                  overflowing it — the row it replaces is the same width. */}
              {renaming ? (
                editing.confirmingRemove ? (
                  <div className="relative z-10 flex w-full flex-wrap items-center justify-end gap-2">
                    <span className="mr-auto text-xs text-muted">Remove it?</span>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, confirmingRemove: false })
                      }
                      className={chip}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(account)}
                      disabled={busy}
                      className="relative z-10 inline-flex items-center gap-1 rounded-md bg-negative px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      {busy ? "Removing…" : "Remove"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({ ...editing, confirmingRemove: true })
                      }
                      className={`${chip} mr-auto hover:text-negative`}
                      disabled={busy}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      Remove
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(null);
                        setError(null);
                      }}
                      className={chip}
                      disabled={busy}
                    >
                      Cancel
                    </button>
                  </>
                )
              ) : (
                <>
                  {canHoldTarget(account.type) && !retargeting ? (
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          kind: "target",
                          id: account.id,
                          value: account.targetCents
                            ? (account.targetCents / 100).toFixed(2)
                            : "",
                        })
                      }
                      disabled={!uid}
                      className={chip}
                    >
                      <Icon name="target" className="h-3.5 w-3.5" />
                      {account.targetCents ? "Edit target" : "Set target"}
                    </button>
                  ) : null}

                  {/* Bottom-right, where the eye finishes reading the card:
                      the balance raises "and now?", and this is the answer. */}
                  <button
                    type="button"
                    aria-label={`Add an entry to ${account.name}`}
                    onClick={() => onQuickAdd(account)}
                    disabled={!uid}
                    className="relative z-10 flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <Icon name="plus" className="h-4 w-4" />
                  </button>
                </>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
