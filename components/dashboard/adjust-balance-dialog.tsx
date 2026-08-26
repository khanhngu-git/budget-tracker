"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import {
  defaultDateFor,
  formatMonthLabel,
  formatMoney,
  formatSignedMoney,
  fromDateInputValue,
  parseBalanceToCents,
  toDateInputValue,
} from "@/lib/budget/format";
import { BudgetError, adjustAccountBalance } from "@/lib/budget/transactions";
import { isDebt, type Account } from "@/lib/budget/types";

/**
 * Restates a savings or investment balance to whatever the provider actually
 * says it is.
 *
 * The user types the new balance rather than the change, because that's the
 * number they're reading off a statement. The difference is worked out here
 * and filed as a gain or a loss, so the history still explains every movement.
 */
export function AdjustBalanceDialog({
  uid,
  account,
  currentCents,
  monthStart,
  open,
  onClose,
}: {
  uid: string;
  account: Account;
  /** What the account closed the viewed month at. */
  currentCents: number;
  monthStart: Date;
  open: boolean;
  onClose: () => void;
}) {
  // A debt is read off a statement as what's outstanding, so that's what the
  // field holds; the sign is put back on when the target balance is worked out.
  const owed = isDebt(account.type);
  const [balance, setBalance] = useState(() =>
    (Math.abs(currentCents) / 100).toFixed(2),
  );
  const [note, setNote] = useState("");
  const [date, setDate] = useState(() =>
    toDateInputValue(defaultDateFor(monthStart)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const entered = parseBalanceToCents(balance);
  const parsed = entered === null ? null : owed ? -entered : entered;
  const difference = parsed === null ? null : parsed - currentCents;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (parsed === null) {
      setError(
        owed
          ? "Enter what's still owed, like 2400.00."
          : "Enter the new balance, like 12500.00.",
      );
      return;
    }

    setError(null);
    setPending(true);
    try {
      await adjustAccountBalance(uid, account.id, {
        differenceCents: parsed - currentCents,
        note: note.trim(),
        date: fromDateInputValue(date),
      });
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
      title={`Update ${account.name}`}
      description={
        owed
          ? `${formatMonthLabel(monthStart)} closed with ${formatMoney(
              Math.abs(currentCents),
            )} outstanding. Enter what's owed now and the difference is filed as growth or a loss.`
          : `${formatMonthLabel(monthStart)} closed at ${formatMoney(
              currentCents,
            )}. Enter what it was actually worth and the difference is filed as growth or a loss.`
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field
          label={owed ? "Still owed" : "New balance"}
          htmlFor="adjust-balance"
          hint={
            difference === null || difference === 0
              ? undefined
              : `${difference > 0 ? "Growth" : "Loss"} of ${formatSignedMoney(
                  difference,
                )}`
          }
        >
          <TextInput
            id="adjust-balance"
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={balance}
            onChange={(event) => setBalance(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        <Field label="Date" htmlFor="adjust-date">
          <TextInput
            id="adjust-date"
            type="date"
            value={date}
            min={toDateInputValue(monthStart)}
            max={toDateInputValue(defaultDateFor(monthStart))}
            onChange={(event) => setDate(event.target.value)}
            disabled={pending}
            required
          />
        </Field>

        <Field label="Note" htmlFor="adjust-note" hint="Optional">
          <TextInput
            id="adjust-note"
            placeholder="Quarterly interest"
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
            {pending ? "Saving…" : "Save balance"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
