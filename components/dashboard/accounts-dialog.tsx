"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import {
  ACCOUNT_PRESETS,
  MAX_ACCOUNT_NAME,
  createAccount,
} from "@/lib/budget/accounts";
import { BudgetError } from "@/lib/budget/error";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
} from "@/lib/budget/types";

/**
 * Adding one account. Nothing else.
 *
 * It used to list every account you already had, with a rename field and a
 * delete button on each — which meant opening "Add" showed you six rows of
 * things you weren't trying to change, and the thing you *were* trying to do
 * was below the fold. Renaming and removing now happen on the account's own
 * card, where the account is, so this dialog answers one question.
 *
 * A name is only ever a label; the type beside it is what the app reasons
 * about, deciding whether everyday spending can come out of an account and
 * which savings or investing goal a transfer counts toward.
 */
export function AccountsDialog({
  uid,
  accounts,
  open,
  onClose,
}: {
  uid: string;
  /** Only to place the new one last and to catch a duplicate name. */
  accounts: Account[];
  open: boolean;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<{ name: string; type: AccountType }>({
    name: "",
    type: "spending",
  });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = draft.name.trim();
    if (name === "") {
      setError("Give the account a name.");
      return;
    }
    if (
      accounts.some(
        (account) => account.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      setError("You already have an account with that name.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await createAccount(uid, { name, type: draft.type, order: accounts.length });
      onClose();
    } catch (caught) {
      setError(
        caught instanceof BudgetError
          ? caught.message
          : "Couldn't add that account. Please try again.",
      );
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add an account">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Presets fill the form rather than submitting it, so the name stays
            editable — "Savings" is a starting point, not the answer. */}
        <div className="flex flex-wrap gap-1.5">
          {ACCOUNT_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setError(null);
                setDraft({ name: preset.name, type: preset.type });
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                draft.name === preset.name
                  ? "border-foreground text-foreground"
                  : "border-border text-muted hover:border-muted/50 hover:text-foreground"
              }`}
            >
              <Icon
                name={ACCOUNT_TYPE_ICONS[preset.type]}
                className="h-3.5 w-3.5"
              />
              {preset.name}
            </button>
          ))}
        </div>

        <Field label="Name" htmlFor="account-name">
          <TextInput
            id="account-name"
            autoFocus
            placeholder="Coin jar"
            value={draft.name}
            maxLength={MAX_ACCOUNT_NAME}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            disabled={pending}
            required
          />
        </Field>

        <Field
          label="Kind of account"
          htmlFor="account-type"
          hint={ACCOUNT_TYPE_BLURBS[draft.type]}
        >
          <Select
            id="account-type"
            value={draft.type}
            options={ACCOUNT_TYPES.map((type) => ({
              value: type,
              label: ACCOUNT_TYPE_LABELS[type],
              icon: ACCOUNT_TYPE_ICONS[type],
            }))}
            onChange={(type) =>
              setDraft((current) => ({ ...current, type: type as AccountType }))
            }
            disabled={pending}
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
            <Icon name="plus" className="h-4 w-4" />
            {pending ? "Adding…" : "Add account"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
