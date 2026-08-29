"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import {
  ACCOUNT_PRESETS,
  MAX_ACCOUNT_NAME,
  createAccount,
  deleteAccount,
  reorderAccounts,
  updateAccount,
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

const TYPE_OPTIONS = ACCOUNT_TYPES.map((type) => ({
  value: type,
  label: ACCOUNT_TYPE_LABELS[type],
  icon: ACCOUNT_TYPE_ICONS[type],
}));

function messageFor(caught: unknown, fallback: string): string {
  return caught instanceof BudgetError ? caught.message : fallback;
}

/* ── The list ───────────────────────────────────────────────────────── */

type RowEdit = { id: string; name: string; type: AccountType; confirming: boolean };

/**
 * Every account, in the order they appear on the Overview, each one editable.
 *
 * Dragging is done with pointer events rather than HTML5 drag-and-drop. The
 * native API only fires for a mouse — it has no touch story at all — and it
 * cancels the moment the dragged node is moved in the DOM, which is precisely
 * what previewing a reorder does. Pointer capture has neither problem: one
 * element keeps receiving the moves wherever the finger goes, and the rows are
 * free to rearrange underneath it.
 *
 * The arrows do the same job without a drag, which is what makes the order
 * reachable from a keyboard.
 */
function AccountList({
  uid,
  accounts,
  onError,
}: {
  uid: string;
  accounts: Account[];
  onError: (message: string | null) => void;
}) {
  /** The arrangement being dragged out, before it is written. Null follows the server. */
  const [draft, setDraft] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [edit, setEdit] = useState<RowEdit | null>(null);
  const [pending, setPending] = useState(false);
  const listRef = useRef<HTMLUListElement>(null);

  const byId = new Map(accounts.map((account) => [account.id, account]));
  // A draft that has fallen behind — an account added or removed in another
  // tab mid-drag — is discarded rather than rendered with holes in it.
  const candidate =
    draft && draft.length === accounts.length
      ? draft
          .map((id) => byId.get(id))
          .filter((account): account is Account => account !== undefined)
      : accounts;
  const shown = candidate.length === accounts.length ? candidate : accounts;
  const ids = shown.map((account) => account.id);

  /** Moves one account to a position, in the list as it currently reads. */
  function moved(id: string, to: number): string[] {
    const from = ids.indexOf(id);
    if (from === -1) return ids;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(Math.max(0, Math.min(next.length, to)), 0, id);
    return next;
  }

  /** Which row the pointer is currently over, by the rows' own midpoints. */
  function indexAt(clientY: number): number {
    const rows = Array.from(listRef.current?.children ?? []) as HTMLElement[];
    for (let index = 0; index < rows.length; index += 1) {
      const box = rows[index].getBoundingClientRect();
      if (clientY < box.top + box.height / 2) return index;
    }
    return Math.max(0, rows.length - 1);
  }

  async function saveOrder(next: string[]) {
    setDraft(next);
    onError(null);
    try {
      await reorderAccounts(uid, next);
      // The subscription echoes a local write immediately, so the draft has
      // done its job — anything still different is the server's answer.
      setDraft(null);
    } catch {
      setDraft(null);
      onError("Couldn't save the new order. Please try again.");
    }
  }

  function move(id: string, to: number) {
    if (to < 0 || to >= shown.length) return;
    void saveOrder(moved(id, to));
  }

  async function commit() {
    if (!edit) return;
    const account = byId.get(edit.id);
    if (!account) return;

    const name = edit.name.trim();
    if (name === "") {
      onError("Give the account a name.");
      return;
    }
    if (
      accounts.some(
        (other) =>
          other.id !== edit.id &&
          other.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      onError("You already have an account with that name.");
      return;
    }
    if (name === account.name && edit.type === account.type) {
      setEdit(null);
      return;
    }

    onError(null);
    setPending(true);
    try {
      await updateAccount(uid, edit.id, { name, type: edit.type });
      setEdit(null);
    } catch (caught) {
      onError(messageFor(caught, "Couldn't save that account. Please try again."));
    } finally {
      setPending(false);
    }
  }

  async function remove(id: string) {
    onError(null);
    setPending(true);
    try {
      await deleteAccount(uid, id);
      setEdit(null);
    } catch (caught) {
      // Refusals here are the useful kind — an account holding money, or one
      // with history behind it — and each states the way out of itself.
      onError(messageFor(caught, "Couldn't remove that account. Please try again."));
    } finally {
      setPending(false);
    }
  }

  if (accounts.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium text-foreground">Your accounts</p>
        <p className="text-xs text-muted">
          Drag a row — or use the arrows — to set the order they appear on the
          Overview. The first one here is the first card you see.
        </p>
      </div>

      <ul ref={listRef} className="flex flex-col gap-1">
        {shown.map((account, index) => {
          const editing = edit?.id === account.id;
          const dragging = draggingId === account.id;

          if (editing) {
            return (
              <li
                key={account.id}
                className="flex flex-col gap-3 rounded-lg border border-accent bg-surface p-3"
              >
                <Field label="Name" htmlFor={`edit-name-${account.id}`}>
                  <TextInput
                    id={`edit-name-${account.id}`}
                    autoFocus
                    value={edit.name}
                    maxLength={MAX_ACCOUNT_NAME}
                    disabled={pending}
                    onChange={(event) =>
                      setEdit({ ...edit, name: event.target.value })
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void commit();
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        setEdit(null);
                      }
                    }}
                  />
                </Field>

                <Field
                  label="Kind of account"
                  htmlFor={`edit-type-${account.id}`}
                  hint={ACCOUNT_TYPE_BLURBS[edit.type]}
                >
                  <Select
                    id={`edit-type-${account.id}`}
                    value={edit.type}
                    options={TYPE_OPTIONS}
                    disabled={pending}
                    onChange={(type) =>
                      setEdit({ ...edit, type: type as AccountType })
                    }
                  />
                </Field>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {/* Two clicks, in place: removing an account is the one thing
                      in this dialog that can't be undone by typing again. */}
                  {edit.confirming ? (
                    <span className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={pending}
                        onClick={() => void remove(account.id)}
                      >
                        <Icon name="trash" className="h-3.5 w-3.5" />
                        {pending ? "Removing…" : "Really remove"}
                      </Button>
                      <button
                        type="button"
                        onClick={() => setEdit({ ...edit, confirming: false })}
                        className="text-xs font-medium text-muted underline underline-offset-2 hover:text-foreground"
                      >
                        Keep it
                      </button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => setEdit({ ...edit, confirming: true })}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                      Remove
                    </Button>
                  )}

                  <span className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={pending}
                      onClick={() => {
                        onError(null);
                        setEdit(null);
                      }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      onClick={() => void commit()}
                    >
                      {pending ? "Saving…" : "Save"}
                    </Button>
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li
              key={account.id}
              className={`flex items-center gap-2 rounded-lg border border-border bg-surface px-2 py-2 ${
                dragging ? "opacity-60" : ""
              }`}
            >
              <button
                type="button"
                aria-label={`Reorder ${account.name}. Drag, or use the arrow keys.`}
                disabled={pending || shown.length < 2}
                // `touch-none` is what stops a phone reading the first
                // millimetre of a drag as a scroll and taking the gesture.
                className="flex h-8 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground active:cursor-grabbing disabled:opacity-30"
                onPointerDown={(event) => {
                  if (event.pointerType === "mouse" && event.button !== 0) return;
                  if (shown.length < 2) return;
                  event.preventDefault();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDraggingId(account.id);
                }}
                onPointerMove={(event) => {
                  if (draggingId !== account.id) return;
                  const next = moved(account.id, indexAt(event.clientY));
                  // Only when it actually changes: a pointer that hasn't left
                  // the row would otherwise re-render on every event.
                  if (next.join() !== ids.join()) setDraft(next);
                }}
                onPointerUp={(event) => {
                  if (draggingId !== account.id) return;
                  event.currentTarget.releasePointerCapture(event.pointerId);
                  setDraggingId(null);
                  void saveOrder(ids);
                }}
                onPointerCancel={() => {
                  setDraggingId(null);
                  setDraft(null);
                }}
                onKeyDown={(event) => {
                  const back = event.key === "ArrowUp" || event.key === "ArrowLeft";
                  const forward =
                    event.key === "ArrowDown" || event.key === "ArrowRight";
                  if (!back && !forward) return;
                  event.preventDefault();
                  move(account.id, index + (back ? -1 : 1));
                }}
              >
                <Icon name="grip" className="h-4 w-4" />
              </button>

              <Icon
                name={ACCOUNT_TYPE_ICONS[account.type]}
                className="h-4 w-4 shrink-0 text-muted"
              />

              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-foreground">
                  {account.name}
                </span>
                <span className="truncate text-xs text-muted">
                  {ACCOUNT_TYPE_LABELS[account.type]}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  aria-label={`Edit ${account.name}`}
                  disabled={pending}
                  onClick={() => {
                    onError(null);
                    setEdit({
                      id: account.id,
                      name: account.name,
                      type: account.type,
                      confirming: false,
                    });
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
                >
                  <Icon name="pencil" className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${account.name} up`}
                  disabled={pending || index === 0}
                  onClick={() => move(account.id, index - 1)}
                  className="flex h-8 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
                >
                  <Icon name="chevronDown" className="h-3.5 w-3.5 rotate-180" />
                </button>
                <button
                  type="button"
                  aria-label={`Move ${account.name} down`}
                  disabled={pending || index === shown.length - 1}
                  onClick={() => move(account.id, index + 1)}
                  className="flex h-8 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
                >
                  <Icon name="chevronDown" className="h-3.5 w-3.5" />
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── The dialog ─────────────────────────────────────────────────────── */

/**
 * The accounts themselves: what they're called, what kind they are, what order
 * they sit in, and adding another.
 *
 * Correcting a *balance* is still the card's job on the Overview, because that
 * writes a gain or a loss into the ledger and wants the date and note that go
 * with it. Everything else about an account is here, where the whole set is.
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
  /** The order to show, to place the new one last, and to catch a duplicate name. */
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
  // Adding is the second job here, not the first, so the form stays folded
  // until it's asked for — otherwise the list opens below two fields nobody
  // came for. Someone with no accounts at all came for exactly those fields.
  const [adding, setAdding] = useState(accounts.length === 0);

  // Nothing typed yet is not "custom" — it's nothing typed yet. The custom
  // tile only reads as chosen once the name has stopped matching a preset.
  const custom =
    draft.name.trim() !== "" &&
    !ACCOUNT_PRESETS.some((preset) => preset.name === draft.name);

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
      setError(messageFor(caught, "Couldn't add that account. Please try again."));
      setPending(false);
    }
  }

  const errorBanner = error ? (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
    >
      {error}
    </p>
  ) : null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit accounts"
      description="Rename them, change what kind they are, set their order, or add another. Balances are corrected on the card itself."
    >
      <div className="flex flex-col gap-5">
        <AccountList uid={uid} accounts={accounts} onError={setError} />

        {adding ? (
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 border-t border-border pt-5"
          >
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-foreground">
                Add an account
              </p>
              {/* Presets fill the form rather than submitting it, so the name
                  stays editable — "Savings" is a starting point, not the
                  answer. The custom tile exists to say so out loud: without one
                  a row of ready-made names reads as the only menu on offer. */}
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

                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setDraft({ name: "", type: "spending" });
                    document.getElementById("account-name")?.focus();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-lg border border-dashed px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    custom
                      ? "border-foreground text-foreground"
                      : "border-border text-muted hover:border-muted/50 hover:text-foreground"
                  }`}
                >
                  <Icon name="pencil" className="h-3.5 w-3.5" />
                  Something else
                </button>
              </div>
            </div>

            <Field
              label="Name"
              htmlFor="account-name"
              hint="Anything you like — it's what you'll see on the card."
            >
              <TextInput
                id="account-name"
                autoFocus
                placeholder="Coin jar"
                value={draft.name}
                maxLength={MAX_ACCOUNT_NAME}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
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
                options={TYPE_OPTIONS}
                onChange={(type) =>
                  setDraft((current) => ({
                    ...current,
                    type: type as AccountType,
                  }))
                }
                disabled={pending}
              />
            </Field>

            {errorBanner}

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
        ) : (
          <>
            {errorBanner}

            <div className="flex justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null);
                  setAdding(true);
                }}
              >
                <Icon name="plus" className="h-4 w-4" />
                Add an account
              </Button>
              <Button type="button" onClick={onClose}>
                Done
              </Button>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}
