"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { categoryIcon, categoryLabel } from "@/lib/budget/categories";
import {
  dayKey,
  formatDay,
  formatDayHeading,
  formatMoney,
  formatSignedMoney,
} from "@/lib/budget/format";
import { isUpcoming } from "@/lib/budget/ledger";
import { BudgetError, deleteTransaction } from "@/lib/budget/transactions";
import {
  isDebt,
  isEveryday,
  type Account,
  type Transaction,
} from "@/lib/budget/types";

/** Accounts by id, so a row can name the account it moved. */
type AccountLookup = Record<string, Account>;

function amountDisplay(transaction: Transaction) {
  switch (transaction.kind) {
    case "income":
    case "gain":
      return {
        text: `+${formatMoney(transaction.amountCents)}`,
        tone: "text-positive",
      };
    case "expense":
      return {
        text: `−${formatMoney(transaction.amountCents)}`,
        tone: "text-foreground",
      };
    case "loss":
      return {
        text: `−${formatMoney(transaction.amountCents)}`,
        tone: "text-negative",
      };
    case "transfer":
      return { text: formatMoney(transaction.amountCents), tone: "text-muted" };
  }
}

/** An account that has since been renamed still has to render as something. */
function nameOf(accounts: AccountLookup, id: string | null): string {
  if (!id) return "—";
  return accounts[id]?.name ?? "Closed account";
}

function describe(transaction: Transaction, accounts: AccountLookup): string {
  switch (transaction.kind) {
    case "transfer":
      return `${nameOf(accounts, transaction.accountId)} → ${nameOf(
        accounts,
        transaction.toAccountId,
      )}`;
    // Savings and investments genuinely grow on their own; a change to an
    // everyday account is someone correcting the number, so it says so.
    case "gain":
    case "loss": {
      const account = accounts[transaction.accountId];
      const name = nameOf(accounts, transaction.accountId);
      if (account && isEveryday(account.type)) return `${name} adjusted`;
      // On a debt the balance rising means less is owed, so "growth" would be
      // exactly the wrong word for it.
      if (account && isDebt(account.type)) {
        return `${name} ${
          transaction.kind === "gain" ? "written off" : "interest"
        }`;
      }
      return `${name} ${transaction.kind === "gain" ? "growth" : "loss"}`;
    }
    default:
      return categoryLabel(transaction.categoryId);
  }
}

/**
 * The quiet second line: which account, and the note. The date lives in the
 * day heading above the group now, so repeating it on every row would just be
 * the same string forty times down the page.
 */
function detailLine(transaction: Transaction, accounts: AccountLookup): string {
  const parts: string[] = [];

  if (transaction.kind === "income" || transaction.kind === "expense") {
    parts.push(nameOf(accounts, transaction.accountId));
  }
  if (transaction.note) parts.push(transaction.note);

  return parts.join(" · ");
}

/**
 * What a single day did to the books: income and gains less expenses and
 * losses. Transfers are left out — moving money between your own accounts
 * doesn't make the day better or worse.
 */
function netFor(transactions: Transaction[]): number {
  return transactions.reduce((sum, transaction) => {
    switch (transaction.kind) {
      case "income":
      case "gain":
        return sum + transaction.amountCents;
      case "expense":
      case "loss":
        return sum - transaction.amountCents;
      default:
        return sum;
    }
  }, 0);
}

type Day = { key: string; date: Date; entries: Transaction[] };

/**
 * Splits the month into days, newest first.
 *
 * The feed arrives sorted newest-first — by day, and by when each entry was
 * recorded within the day — so grouping just walks it and starts a new bucket
 * whenever the date changes. That order is preserved rather than re-sorted,
 * and no day can appear twice.
 */
function byDay(transactions: Transaction[]): Day[] {
  const days: Day[] = [];

  for (const transaction of transactions) {
    const key = dayKey(transaction.date);
    const current = days[days.length - 1];
    if (current && current.key === key) {
      current.entries.push(transaction);
    } else {
      days.push({ key, date: transaction.date, entries: [transaction] });
    }
  }

  return days;
}

function iconFor(transaction: Transaction): IconName {
  switch (transaction.kind) {
    case "transfer":
      return "swap";
    case "gain":
      return "trendUp";
    case "loss":
      return "trendDown";
    default:
      return categoryIcon(transaction.categoryId);
  }
}

export function TransactionList({
  uid,
  transactions,
  asOf,
  accounts,
  loading,
  onEdit,
}: {
  uid: string | null;
  transactions: Transaction[];
  /**
   * The instant the month's balances are stated as at. Entries dated at or
   * after it haven't happened yet: they're shown, but they count towards
   * nothing. Passed in rather than read from the clock here so a row can't
   * disagree with the balance and the net it's sitting under.
   */
  asOf: Date;
  accounts: AccountLookup;
  loading: boolean;
  onEdit: (transaction: Transaction) => void;
}) {
  const asOfTime = asOf.getTime();
  // Deleting moves money, so it takes two deliberate clicks. The confirmation
  // lives in the row rather than a modal: the entry being reversed stays
  // visible while the user decides.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(transaction: Transaction) {
    if (!uid) return;
    setError(null);
    setPendingId(transaction.id);
    try {
      await deleteTransaction(uid, transaction.id);
      setConfirmingId(null);
    } catch (caught) {
      setError(
        caught instanceof BudgetError
          ? caught.message
          : "Couldn't delete that entry. Please try again.",
      );
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Loading transactions…
      </p>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          Nothing recorded this month
        </p>
        <p className="mt-1 text-sm text-muted">
          Add an entry and the history starts here.
        </p>
      </div>
    );
  }

  const iconButton =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {byDay(transactions).map((day) => {
        // A day is upcoming or it isn't — never half of each. Entries are
        // dated at local midnight and the cutoff falls on a midnight, so every
        // entry grouped under one date answers this the same way. That's what
        // lets the whole day's box carry the treatment instead of each row.
        const upcoming = day.entries.some((entry) =>
          isUpcoming(entry, asOfTime),
        );
        const dayNet = netFor(day.entries);

        return (
          <section key={day.key} className="flex flex-col gap-2">
            {/* The day is stated once, above its entries, with what it came to.
                Scanning a month is looking for the day something happened. */}
            <div className="flex items-baseline justify-between gap-3 px-1">
              <h3 className="text-sm font-medium text-foreground">
                {formatDayHeading(day.date)}
              </h3>
              {/* Nothing has been earned or spent on a day still to come, so
                  it has no net to state. Saying so in words is also what
                  carries the meaning to a screen reader, which gets nothing
                  from a dotted border and a fade. */}
              {upcoming ? (
                <p className="shrink-0 text-xs font-medium text-muted">
                  Upcoming
                </p>
              ) : dayNet === 0 ? null : (
                <p
                  className={`shrink-0 text-xs font-medium tabular-nums ${
                    dayNet > 0 ? "text-positive" : "text-negative"
                  }`}
                >
                  {formatSignedMoney(dayNet)}
                </p>
              )}
            </div>

            {/* The dotted border replaces the solid one — the row dividers
                with it — so money that hasn't moved is drawn provisionally
                rather than drawn twice. */}
            <ul
              className={`divide-y overflow-hidden rounded-2xl border bg-surface ${
                upcoming
                  ? "divide-dotted divide-muted/50 border-dotted border-muted/50 opacity-60"
                  : "divide-border border-border"
              }`}
            >
              {day.entries.map((transaction) => {
                const amount = amountDisplay(transaction);
                const label = describe(transaction, accounts);
                const detail = detailLine(transaction, accounts);
                const confirming = confirmingId === transaction.id;
                const pending = pendingId === transaction.id;

                return (
                  <li
                    key={transaction.id}
                    className="flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5"
                  >
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
                    >
                      <Icon
                        name={iconFor(transaction)}
                        className="h-4.5 w-4.5"
                      />
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                        <span className="truncate">{label}</span>
                        {/* Entries nobody typed. Without this they simply
                            appear, and an entry you don't remember making is
                            indistinguishable from a bug. */}
                        {transaction.recurringId ? (
                          <span
                            title="Added by a recurring entry"
                            className="shrink-0 text-muted"
                          >
                            <Icon name="repeat" className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </p>
                      {/* A transfer with no note has nothing left to say here —
                          the row above already names both accounts. */}
                      {detail ? (
                        <p className="truncate text-xs text-muted">{detail}</p>
                      ) : null}
                    </div>

                    {confirming ? (
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="hidden text-xs text-muted sm:inline">
                          Delete and undo it?
                        </span>
                        <button
                          type="button"
                          onClick={() => setConfirmingId(null)}
                          disabled={pending}
                          className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(transaction)}
                          disabled={pending}
                          className="rounded-md bg-negative px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                        >
                          {pending ? "Deleting…" : "Delete"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div
                          className={`shrink-0 text-sm font-medium tabular-nums ${amount.tone}`}
                        >
                          {amount.text}
                        </div>

                        <div className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => onEdit(transaction)}
                            disabled={!uid}
                            aria-label={`Edit ${label} on ${formatDay(transaction.date)}`}
                            className={`${iconButton} hover:text-foreground`}
                          >
                            <Icon name="pencil" className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setError(null);
                              setConfirmingId(transaction.id);
                            }}
                            disabled={!uid}
                            aria-label={`Delete ${label} on ${formatDay(transaction.date)}`}
                            className={`${iconButton} hover:text-negative`}
                          >
                            <Icon name="trash" className="h-4 w-4" />
                          </button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
