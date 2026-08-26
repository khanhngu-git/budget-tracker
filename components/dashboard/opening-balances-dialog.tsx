"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { parseBalanceToCents } from "@/lib/budget/format";
import { markOpeningBalancesSet } from "@/lib/budget/profile";
import { BudgetError, setAccountBalances } from "@/lib/budget/transactions";
import {
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  type Account,
} from "@/lib/budget/types";

/**
 * The one-time prompt a new account opens with.
 *
 * Starting everyone at zero makes the first month's figures fiction — the
 * spending balance goes negative on the first expense and the allocation chart
 * has nothing to divide. Asking once, up front, is what makes every number
 * after it true.
 *
 * The differences are filed as ordinary gains and losses dated to the start of
 * the month, so the ledger still explains where every balance came from.
 */
export function OpeningBalancesDialog({
  uid,
  accounts,
  open,
  onClose,
}: {
  uid: string;
  accounts: Account[];
  open: boolean;
  onClose: () => void;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "skip" | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const targets: Record<string, number> = {};
    for (const account of accounts) {
      // A blank field means "nothing in it" rather than an error — most people
      // won't have money in every account.
      const raw = (amounts[account.id] ?? "").trim();
      const cents = raw === "" ? 0 : parseBalanceToCents(raw);
      if (cents === null) {
        setError(`Enter ${account.name} as an amount, like 1250.00.`);
        return;
      }
      targets[account.id] = cents;
    }

    setError(null);
    setPending("save");
    try {
      const now = new Date();
      await setAccountBalances(uid, targets, {
        note: "Opening balance",
        date: new Date(now.getFullYear(), now.getMonth(), 1),
      });
      await markOpeningBalancesSet(uid);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof BudgetError
          ? caught.message
          : "Couldn't save those balances. Please try again.",
      );
      setPending(null);
    }
  }

  async function handleSkip() {
    setError(null);
    setPending("skip");
    try {
      await markOpeningBalancesSet(uid);
      onClose();
    } catch {
      setError("Couldn't save that. Please try again.");
      setPending(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What have you got right now?"
      description="Enter what each account holds today. You can change any of them later, add more accounts at any time, and leaving one blank just means it's empty."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {accounts.map((account, index) => (
          <Field
            key={account.id}
            label={account.name}
            htmlFor={`opening-${account.id}`}
            hint={ACCOUNT_TYPE_BLURBS[account.type]}
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
              >
                <Icon
                  name={ACCOUNT_TYPE_ICONS[account.type]}
                  className="h-4.5 w-4.5"
                />
              </span>
              <TextInput
                id={`opening-${account.id}`}
                autoFocus={index === 0}
                inputMode="decimal"
                placeholder="0.00"
                value={amounts[account.id] ?? ""}
                onChange={(event) =>
                  setAmounts((current) => ({
                    ...current,
                    [account.id]: event.target.value,
                  }))
                }
                disabled={pending !== null}
              />
            </div>
          </Field>
        ))}

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
            onClick={handleSkip}
            disabled={pending !== null}
          >
            {pending === "skip" ? "Saving…" : "Start at zero"}
          </Button>
          <Button type="submit" disabled={pending !== null}>
            {pending === "save" ? "Saving…" : "Save balances"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
