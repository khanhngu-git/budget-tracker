"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { AccountSelect, spendableAccounts } from "@/components/dashboard/account-select";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { categoriesFor } from "@/lib/budget/categories";
import {
  fromDateInputValue,
  parseAmountToCents,
  toDateInputValue,
} from "@/lib/budget/format";
import {
  FREQUENCIES,
  FREQUENCY_LABELS,
  type Frequency,
} from "@/lib/budget/recurrence";
import {
  saveRecurringRule,
  type RecurringInput,
} from "@/lib/budget/recurring";
import { BudgetError } from "@/lib/budget/error";
import {
  type Account,
  type RecurringKind,
  type RecurringRule,
} from "@/lib/budget/types";

const TABS = [
  { value: "expense", label: "Expense", icon: "bag" },
  { value: "income", label: "Income", icon: "banknote" },
  { value: "transfer", label: "Transfer", icon: "swap" },
] as const;

/**
 * Changes a standing instruction that already exists.
 *
 * There is no "new" here on purpose: a schedule is created by ticking Repeat
 * on an ordinary entry, so the first occurrence is always something the user
 * actually saw and confirmed rather than a date they typed into an abstract
 * form. This dialog only ever edits.
 */
export function RecurringDialog({
  uid,
  accounts,
  rule,
  open,
  onClose,
}: {
  uid: string;
  accounts: Account[];
  rule: RecurringRule;
  open: boolean;
  onClose: () => void;
}) {
  const spendable = spendableAccounts(accounts);

  const [kind, setKind] = useState<RecurringKind>(rule.kind);
  const [amount, setAmount] = useState(() =>
    (rule.amountCents / 100).toFixed(2),
  );
  const [categoryId, setCategoryId] = useState(
    () =>
      rule.categoryId ??
      categoriesFor(rule.kind === "income" ? "income" : "expense")[0].id,
  );
  const [account, setAccount] = useState(
    () => rule.accountId ?? spendable[0]?.id ?? "",
  );
  const [from, setFrom] = useState(
    () =>
      (rule.kind === "transfer" ? rule.accountId : null) ??
      spendable[0]?.id ??
      "",
  );
  const [to, setTo] = useState(
    () =>
      rule.toAccountId ??
      accounts.find((option) => option.id !== spendable[0]?.id)?.id ??
      "",
  );
  const [frequency, setFrequency] = useState<Frequency>(rule.frequency);
  const [startDate, setStartDate] = useState(() =>
    toDateInputValue(rule.startDate),
  );
  const [ending, setEnding] = useState<"never" | "on">(
    rule.endDate ? "on" : "never",
  );
  const [endDate, setEndDate] = useState(() =>
    rule.endDate ? toDateInputValue(rule.endDate) : "",
  );
  const [note, setNote] = useState(rule.note);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const flow = kind === "income" ? "income" : "expense";

  function switchKind(next: RecurringKind) {
    setKind(next);
    if (next === "income" || next === "expense") {
      const flowFor = next === "income" ? "income" : "expense";
      if (!categoriesFor(flowFor).some((option) => option.id === categoryId)) {
        setCategoryId(categoriesFor(flowFor)[0].id);
      }
    }
  }

  /** Keeps the two transfer selects from landing on the same account. */
  function changeFrom(next: string) {
    setFrom(next);
    if (next === to) {
      setTo(accounts.find((option) => option.id !== next)?.id ?? "");
    }
  }

  function changeTo(next: string) {
    setTo(next);
    if (next === from) {
      setFrom(accounts.find((option) => option.id !== next)?.id ?? "");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("Enter an amount like 24.50.");
      return;
    }
    if (ending === "on" && endDate === "") {
      setError("Pick the date it should stop, or choose until further notice.");
      return;
    }

    const input: RecurringInput = {
      kind,
      accountId: kind === "transfer" ? from : account,
      toAccountId: kind === "transfer" ? to : null,
      categoryId: kind === "transfer" ? null : categoryId,
      amountCents,
      note: note.trim(),
      frequency,
      startDate: fromDateInputValue(startDate),
      endDate: ending === "on" ? fromDateInputValue(endDate) : null,
    };

    setError(null);
    setPending(true);
    try {
      await saveRecurringRule(uid, rule.id, input);
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

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit recurring entry"
      description="Changes apply to the occurrences still to come, not the ones already recorded."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div
          role="radiogroup"
          aria-label="Entry type"
          className="grid grid-cols-3 gap-2 rounded-lg border border-border p-1"
        >
          {TABS.map((tab) => (
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

        <Field label="Amount" htmlFor="recurring-amount">
          <TextInput
            id="recurring-amount"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        {kind === "income" || kind === "expense" ? (
          <>
            <Field label="Category" htmlFor="recurring-category">
              <CategoryPicker
                id="recurring-category"
                flow={flow}
                value={categoryId}
                onChange={setCategoryId}
                disabled={pending}
              />
            </Field>

            {accounts.length > 1 ? (
              <Field
                label={kind === "income" ? "Paid into" : "Paid from"}
                htmlFor="recurring-account"
              >
                <AccountSelect
                  id="recurring-account"
                  accounts={accounts}
                  value={account}
                  onChange={setAccount}
                  disabled={pending}
                />
              </Field>
            ) : null}
          </>
        ) : (
          <>
            <Field label="From" htmlFor="recurring-from">
              <Select
                id="recurring-from"
                value={from}
                onChange={(event) => changeFrom(event.target.value)}
                disabled={pending}
              >
                {accounts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="To" htmlFor="recurring-to">
              <Select
                id="recurring-to"
                value={to}
                onChange={(event) => changeTo(event.target.value)}
                disabled={pending}
              >
                {accounts.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        )}

        <Field label="Repeats" htmlFor="recurring-frequency">
          <Select
            id="recurring-frequency"
            value={frequency}
            onChange={(event) =>
              setFrequency(event.target.value as Frequency)
            }
            disabled={pending}
          >
            {FREQUENCIES.map((option) => (
              <option key={option} value={option}>
                {FREQUENCY_LABELS[option]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="First one on"
          htmlFor="recurring-start"
          hint="The day of the month or week it repeats on"
        >
          <TextInput
            id="recurring-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-sm font-medium text-foreground">
            Keeps going
          </legend>
          <div
            role="radiogroup"
            aria-label="When it stops"
            className="grid grid-cols-2 gap-2 rounded-lg border border-border p-1"
          >
            {(
              [
                { value: "never", label: "Until further notice" },
                { value: "on", label: "Until a date" },
              ] as const
            ).map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={ending === option.value}
                onClick={() => setEnding(option.value)}
                disabled={pending}
                className={`inline-flex h-9 items-center justify-center rounded-md px-2 text-sm font-medium transition-colors ${
                  ending === option.value
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {ending === "on" ? (
            <TextInput
              type="date"
              aria-label="Last one on"
              value={endDate}
              min={startDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={pending}
              required
            />
          ) : null}
        </fieldset>

        <Field label="Note" htmlFor="recurring-note" hint="Optional">
          <TextInput
            id="recurring-note"
            placeholder="Rent"
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
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
