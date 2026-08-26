"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  ACCOUNT_PRESETS,
  MAX_ACCOUNT_NAME,
  createAccount,
  deleteAccount,
  normaliseName,
  updateAccount,
} from "@/lib/budget/accounts";
import { BudgetError } from "@/lib/budget/error";
import { formatMoney } from "@/lib/budget/format";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  seriesColor,
  type Account,
  type AccountType,
} from "@/lib/budget/types";

type Draft = { name: string; type: AccountType };

function message(caught: unknown, fallback: string): string {
  return caught instanceof BudgetError ? caught.message : fallback;
}

/**
 * Everything about *which* accounts you have, in one place: add as many as you
 * keep money in, name them whatever you call them, and remove the ones you
 * don't.
 *
 * A name is only ever a label — the type beside it is what the app reasons
 * about, deciding whether everyday spending can come out of an account and
 * which savings or investing goal a transfer counts toward. Saying so on the
 * form is what stops "Holiday fund" being filed as day-to-day money.
 */
export function AccountsDialog({
  uid,
  accounts,
  open,
  onClose,
}: {
  uid: string;
  /** Running balances — deleting is judged against the real total, not a month. */
  accounts: Account[];
  open: boolean;
  onClose: () => void;
}) {
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [newAccount, setNewAccount] = useState<Draft>({
    name: "",
    type: "cash",
  });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draftFor(account: Account): Draft {
    return drafts[account.id] ?? { name: account.name, type: account.type };
  }

  function edit(account: Account, patch: Partial<Draft>) {
    setDrafts((current) => ({
      ...current,
      [account.id]: { ...draftFor(account), ...patch },
    }));
  }

  async function handleSave(account: Account) {
    const draft = draftFor(account);
    setError(null);
    setPendingId(account.id);
    try {
      await updateAccount(uid, account.id, draft);
      // Drop the draft so the row goes back to mirroring what's stored — the
      // Save button disappearing is the confirmation that it landed.
      setDrafts((current) => {
        const next = { ...current };
        delete next[account.id];
        return next;
      });
    } catch (caught) {
      setError(message(caught, "Couldn't save that account. Please try again."));
    } finally {
      setPendingId(null);
    }
  }

  async function handleDelete(account: Account) {
    setError(null);
    setPendingId(account.id);
    try {
      await deleteAccount(uid, account.id);
      setConfirmingId(null);
    } catch (caught) {
      setError(
        message(caught, "Couldn't remove that account. Please try again."),
      );
      setConfirmingId(null);
    } finally {
      setPendingId(null);
    }
  }

  async function handleAdd(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingId("__new");
    try {
      await createAccount(uid, {
        ...newAccount,
        // Appended rather than inserted, so every existing account keeps the
        // colour the reader has already learned.
        order: accounts.reduce((max, a) => Math.max(max, a.order), -1) + 1,
      });
      setNewAccount({ name: "", type: "cash" });
    } catch (caught) {
      setError(message(caught, "Couldn't add that account. Please try again."));
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your accounts"
      description="Add an account for every place you keep money — a current account, a coin jar, a pension. Names are yours to change at any time."
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-3">
          {accounts.map((account, index) => {
            const draft = draftFor(account);
            const dirty =
              normaliseName(draft.name) !== account.name ||
              draft.type !== account.type;
            const busy = pendingId === account.id;
            const color = seriesColor(index);

            return (
              <li
                key={account.id}
                className="flex flex-col gap-2.5 rounded-xl border border-border p-3"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{
                      color,
                      backgroundColor: `color-mix(in oklab, ${color} 14%, var(--surface))`,
                    }}
                  >
                    <Icon
                      name={ACCOUNT_TYPE_ICONS[draft.type]}
                      className="h-4 w-4"
                    />
                  </span>
                  <TextInput
                    aria-label={`Name for ${account.name}`}
                    value={draft.name}
                    maxLength={MAX_ACCOUNT_NAME}
                    onChange={(event) =>
                      edit(account, { name: event.target.value })
                    }
                    disabled={busy}
                    className="h-9 flex-1"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    aria-label={`Type of ${account.name}`}
                    value={draft.type}
                    onChange={(event) =>
                      edit(account, { type: event.target.value as AccountType })
                    }
                    disabled={busy}
                    className="h-9 flex-1"
                  >
                    {ACCOUNT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {ACCOUNT_TYPE_LABELS[type]} — {ACCOUNT_TYPE_BLURBS[type]}
                      </option>
                    ))}
                  </Select>

                  {confirmingId === account.id ? (
                    <>
                      <button
                        type="button"
                        onClick={() => setConfirmingId(null)}
                        disabled={busy}
                        className="shrink-0 rounded-md px-2 py-1.5 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(account)}
                        disabled={busy}
                        className="shrink-0 rounded-md bg-negative px-2.5 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                      >
                        {busy ? "Removing…" : "Remove"}
                      </button>
                    </>
                  ) : (
                    <>
                      {dirty ? (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleSave(account)}
                          disabled={busy}
                        >
                          {busy ? "Saving…" : "Save"}
                        </Button>
                      ) : (
                        <span className="shrink-0 px-1 text-xs tabular-nums text-muted">
                          {formatMoney(account.balanceCents)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setError(null);
                          setConfirmingId(account.id);
                        }}
                        aria-label={`Remove ${account.name}`}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-negative"
                      >
                        <Icon name="trash" className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <form
          onSubmit={handleAdd}
          className="flex flex-col gap-3 border-t border-border pt-5"
        >
          <div className="flex flex-wrap gap-1.5">
            {ACCOUNT_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setNewAccount(preset)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:border-muted/50 hover:text-foreground"
              >
                <Icon
                  name={ACCOUNT_TYPE_ICONS[preset.type]}
                  className="h-3.5 w-3.5"
                />
                {preset.name}
              </button>
            ))}
          </div>

          <Field label="New account" htmlFor="account-name">
            <TextInput
              id="account-name"
              placeholder="Coin jar"
              value={newAccount.name}
              maxLength={MAX_ACCOUNT_NAME}
              onChange={(event) =>
                setNewAccount((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              disabled={pendingId === "__new"}
              required
            />
          </Field>

          <Field
            label="What kind of account is it?"
            htmlFor="account-type"
            hint={ACCOUNT_TYPE_BLURBS[newAccount.type]}
          >
            <Select
              id="account-type"
              value={newAccount.type}
              onChange={(event) =>
                setNewAccount((current) => ({
                  ...current,
                  type: event.target.value as AccountType,
                }))
              }
              disabled={pendingId === "__new"}
            >
              {ACCOUNT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACCOUNT_TYPE_LABELS[type]}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pendingId !== null}
            >
              Done
            </Button>
            <Button type="submit" disabled={pendingId !== null}>
              <Icon name="plus" className="h-4 w-4" />
              {pendingId === "__new" ? "Adding…" : "Add account"}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
