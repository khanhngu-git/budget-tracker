"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { categoryIcon, categoryLabel } from "@/lib/budget/categories";
import { formatDay, formatMoney } from "@/lib/budget/format";
import { BudgetError, deleteTransaction } from "@/lib/budget/transactions";
import { isEveryday, type Account, type Transaction } from "@/lib/budget/types";

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
      return `${name} ${transaction.kind === "gain" ? "growth" : "loss"}`;
    }
    default:
      return categoryLabel(transaction.categoryId);
  }
}

/**
 * The quiet second line: when, out of which account, and the note. With more
 * than one everyday account on the books, "which one" is the difference
 * between a coffee from the coin jar and one off the card.
 */
function detailLine(transaction: Transaction, accounts: AccountLookup): string {
  const parts = [formatDay(transaction.date)];

  if (transaction.kind === "income" || transaction.kind === "expense") {
    parts.push(nameOf(accounts, transaction.accountId));
  }
  if (transaction.note) parts.push(transaction.note);

  return parts.join(" · ");
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
  accounts,
  loading,
  onEdit,
}: {
  uid: string | null;
  transactions: Transaction[];
  accounts: AccountLookup;
  loading: boolean;
  onEdit: (transaction: Transaction) => void;
}) {
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
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {transactions.map((transaction) => {
          const amount = amountDisplay(transaction);
          const label = describe(transaction, accounts);
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
                <Icon name={iconFor(transaction)} className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {label}
                </p>
                <p className="truncate text-xs text-muted">
                  {detailLine(transaction, accounts)}
                </p>
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
    </div>
  );
}
