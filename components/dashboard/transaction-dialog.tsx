"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { categoriesFor } from "@/lib/budget/categories";
import {
  defaultDateFor,
  formatMoney,
  fromDateInputValue,
  parseAmountToCents,
  toDateInputValue,
} from "@/lib/budget/format";
import {
  BudgetError,
  addTransaction,
  updateTransaction,
  type EntryInput,
} from "@/lib/budget/transactions";
import {
  ACCOUNT_KINDS,
  ACCOUNT_LABELS,
  type Account,
  type AccountKind,
  type Transaction,
} from "@/lib/budget/types";

type FormKind = "expense" | "income" | "transfer" | "gain" | "loss";

const TABS = [
  { value: "expense", label: "Expense", icon: "bag" },
  { value: "income", label: "Income", icon: "banknote" },
  { value: "transfer", label: "Transfer", icon: "swap" },
] as const;

const ADJUSTMENT_TABS = [
  { value: "gain", label: "Growth", icon: "trendUp" },
  { value: "loss", label: "Loss", icon: "trendDown" },
] as const;

/**
 * One form for recording an entry and for correcting one.
 *
 * Add and edit are the same fields over the same validation, so they're the
 * same component — a separate edit dialog would be this file with the initial
 * values changed, and would drift from it the first time either side gained a
 * field. Mount it with a `key` tied to the entry being edited so it opens on
 * that entry's values.
 */
export function TransactionDialog({
  uid,
  accounts,
  transaction,
  monthStart,
  open,
  onClose,
}: {
  uid: string;
  /** Running balances — what a new entry actually settles against. */
  accounts: Record<AccountKind, Account>;
  /** null when adding. */
  transaction: Transaction | null;
  /** The month on screen; entries are dated inside it. */
  monthStart: Date;
  open: boolean;
  onClose: () => void;
}) {
  const editing = transaction !== null;
  // A balance adjustment can be corrected but can't be turned into an expense:
  // the two answer different questions, and silently reclassifying one would
  // move money the user never moved.
  const isAdjustment =
    transaction?.kind === "gain" || transaction?.kind === "loss";

  const [kind, setKind] = useState<FormKind>(
    (transaction?.kind as FormKind) ?? "expense",
  );
  const [amount, setAmount] = useState(() =>
    transaction ? (transaction.amountCents / 100).toFixed(2) : "",
  );
  const [categoryId, setCategoryId] = useState(
    () =>
      transaction?.categoryId ??
      categoriesFor(transaction?.kind === "income" ? "income" : "expense")[0].id,
  );
  const [from, setFrom] = useState<AccountKind>(
    transaction?.kind === "transfer" ? transaction.accountId : "spending",
  );
  const [to, setTo] = useState<AccountKind>(
    transaction?.toAccountId ?? "savings",
  );
  const [note, setNote] = useState(transaction?.note ?? "");
  const [date, setDate] = useState(() =>
    toDateInputValue(transaction?.date ?? defaultDateFor(monthStart)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const flow = kind === "income" ? "income" : "expense";
  const options = categoriesFor(flow);

  function switchKind(next: FormKind) {
    setKind(next);
    if (next === "income" || next === "expense") {
      const flowFor = next === "income" ? "income" : "expense";
      // The current category belongs to the other flow, so reset it.
      if (!categoriesFor(flowFor).some((option) => option.id === categoryId)) {
        setCategoryId(categoriesFor(flowFor)[0].id);
      }
    }
  }

  /** Keeps the two transfer selects from landing on the same account. */
  function changeFrom(next: AccountKind) {
    setFrom(next);
    if (next === to) {
      setTo(ACCOUNT_KINDS.find((option) => option !== next) ?? "savings");
    }
  }

  function changeTo(next: AccountKind) {
    setTo(next);
    if (next === from) {
      setFrom(ACCOUNT_KINDS.find((option) => option !== next) ?? "spending");
    }
  }

  function buildInput(amountCents: number): EntryInput {
    const shared = { amountCents, note: note.trim(), date: fromDateInputValue(date) };

    if (kind === "transfer") {
      return { kind, accountId: from, toAccountId: to, ...shared };
    }
    if (kind === "gain" || kind === "loss") {
      return {
        kind,
        accountId: (transaction?.accountId ?? "savings") as AccountKind,
        ...shared,
      };
    }
    return { kind, categoryId, ...shared };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("Enter an amount like 24.50.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      const input = buildInput(amountCents);
      if (transaction) {
        await updateTransaction(uid, transaction.id, input);
      } else {
        await addTransaction(uid, input);
      }
      onClose();
    } catch (caught) {
      setError(
        caught instanceof BudgetError
          ? caught.message
          : "Couldn't save that. Please try again.",
      );
      setPending(false);
    }
  }

  const tabs = isAdjustment ? ADJUSTMENT_TABS : TABS;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit entry" : "Add entry"}
      description={
        isAdjustment && transaction
          ? `A change in ${ACCOUNT_LABELS[transaction.accountId]} that nobody moved.`
          : "Income and expenses are recorded against your Spending account."
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label="Entry type"
          className={`grid gap-2 rounded-lg border border-border p-1 ${
            tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"
          }`}
        >
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="radio"
              aria-checked={kind === tab.value}
              onClick={() => switchKind(tab.value)}
              disabled={pending}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors ${
                kind === tab.value
                  ? "bg-foreground text-background"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon name={tab.icon} className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <Field label="Amount" htmlFor="amount">
          <TextInput
            id="amount"
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        {kind === "income" || kind === "expense" ? (
          <Field label="Category" htmlFor="category">
            <Select
              id="category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={pending}
            >
              {options.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {kind === "transfer" ? (
          <>
            <Field
              label="From"
              htmlFor="from"
              hint={`Available: ${formatMoney(accounts[from].balanceCents)}`}
            >
              <Select
                id="from"
                value={from}
                onChange={(event) =>
                  changeFrom(event.target.value as AccountKind)
                }
                disabled={pending}
              >
                {ACCOUNT_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {ACCOUNT_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="To" htmlFor="to">
              <Select
                id="to"
                value={to}
                onChange={(event) => changeTo(event.target.value as AccountKind)}
                disabled={pending}
              >
                {ACCOUNT_KINDS.map((option) => (
                  <option key={option} value={option}>
                    {ACCOUNT_LABELS[option]}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : null}

        <Field label="Date" htmlFor="date">
          <TextInput
            id="date"
            type="date"
            value={date}
            // Bounded to the month on screen, so a new entry can't land in a
            // month the user isn't looking at and appear to vanish.
            min={toDateInputValue(monthStart)}
            max={toDateInputValue(defaultDateFor(monthStart))}
            onChange={(event) => setDate(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        <Field label="Note" htmlFor="note" hint="Optional">
          <TextInput
            id="note"
            placeholder="Weekly shop"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            disabled={pending}
            maxLength={80}
          />
        </Field>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : editing ? "Save changes" : "Add entry"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
