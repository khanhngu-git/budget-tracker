"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { ACCOUNT_PRESETS, MAX_ACCOUNT_NAME } from "@/lib/budget/accounts";
import { BudgetError } from "@/lib/budget/error";
import { parseBalanceToCents } from "@/lib/budget/format";
import { markOpeningBalancesSet } from "@/lib/budget/profile";
import {
  openAccountsWithBalances,
  setAccountBalances,
} from "@/lib/budget/transactions";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_BLURBS,
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  isDebt,
  type Account,
  type AccountType,
} from "@/lib/budget/types";

type Chosen = {
  /** Local key — a chosen account has no document id until the final save. */
  key: string;
  /** Set only for an account that already exists. */
  id?: string;
  name: string;
  type: AccountType;
  balance: string;
};

let sequence = 0;
function chosenFrom(name: string, type: AccountType): Chosen {
  sequence += 1;
  return { key: `new-${sequence}`, name, type, balance: "" };
}

/**
 * The first thing a new account sees: which accounts do you keep money in, and
 * what's in them?
 *
 * It's two steps rather than one because they're two different questions.
 * Naming your accounts is a decision; typing in balances is copying figures off
 * statements — and being asked for a number next to an account you haven't
 * decided you want yet is what makes a single combined form feel like paperwork.
 *
 * Nothing is written until the last step, so backing out of onboarding leaves
 * no half-built set of accounts behind.
 */
export function OnboardingDialog({
  uid,
  existing,
  open,
  onClose,
}: {
  uid: string;
  /** Accounts already on the books — non-empty only for an older account. */
  existing: Account[];
  open: boolean;
  onClose: () => void;
}) {
  // Someone who already has accounts has answered the first question already;
  // all that's left for them is the balances.
  const [step, setStep] = useState<"choose" | "balances">(
    existing.length > 0 ? "balances" : "choose",
  );
  const [chosen, setChosen] = useState<Chosen[]>(() =>
    existing.map((account) => ({
      key: account.id,
      id: account.id,
      name: account.name,
      type: account.type,
      balance: "",
    })),
  );
  const [custom, setCustom] = useState<{ name: string; type: AccountType }>({
    name: "",
    type: "cash",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "skip" | null>(null);

  const picked = (name: string) =>
    chosen.some((entry) => entry.name.toLowerCase() === name.toLowerCase());

  function togglePreset(preset: { name: string; type: AccountType }) {
    setError(null);
    setChosen((current) =>
      picked(preset.name)
        ? current.filter(
            (entry) => entry.name.toLowerCase() !== preset.name.toLowerCase(),
          )
        : [...current, chosenFrom(preset.name, preset.type)],
    );
  }

  function addCustom() {
    const name = custom.name.trim();
    if (name === "") return;
    if (picked(name)) {
      setError("You've already added an account with that name.");
      return;
    }
    setError(null);
    setChosen((current) => [...current, chosenFrom(name, custom.type)]);
    setCustom({ name: "", type: "cash" });
  }

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    // A blank balance means "nothing in it yet" rather than an error — plenty
    // of accounts genuinely start empty.
    const parsed = chosen.map((entry) => {
      const raw = entry.balance.trim();
      const cents = raw === "" ? 0 : parseBalanceToCents(raw);
      return {
        entry,
        // A debt is typed as what you owe — a plain, positive number, the way
        // a statement prints it — and stored as the negative balance it is.
        cents: cents === null ? null : isDebt(entry.type) ? -cents : cents,
      };
    });

    const bad = parsed.find((row) => row.cents === null);
    if (bad) {
      setError(
        isDebt(bad.entry.type)
          ? `Enter what you owe on ${bad.entry.name} as an amount, like 2400.00.`
          : `Enter ${bad.entry.name} as an amount, like 1250.00.`,
      );
      return;
    }

    setError(null);
    setPending("save");
    try {
      const now = new Date();
      const date = new Date(now.getFullYear(), now.getMonth(), 1);
      const fresh = parsed.filter((row) => row.entry.id === undefined);
      const already = parsed.filter((row) => row.entry.id !== undefined);

      if (fresh.length > 0) {
        await openAccountsWithBalances(
          uid,
          fresh.map((row) => ({
            name: row.entry.name,
            type: row.entry.type,
            balanceCents: row.cents ?? 0,
          })),
          { note: "Opening balance", date, orderFrom: existing.length },
        );
      }

      if (already.length > 0) {
        await setAccountBalances(
          uid,
          Object.fromEntries(
            already.map((row) => [row.entry.id as string, row.cents ?? 0]),
          ),
          { note: "Opening balance", date },
        );
      }

      await markOpeningBalancesSet(uid);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof BudgetError
          ? caught.message
          : "Couldn't set that up. Please try again.",
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

  if (step === "choose") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Where do you keep your money?"
        description="Pick everything that applies — a current account, cash in your pocket, savings, a pension. You can rename these or add more at any time."
      >
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-2">
            {ACCOUNT_PRESETS.map((preset) => {
              const on = picked(preset.name);
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => togglePreset(preset)}
                  aria-pressed={on}
                  className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                    on
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-foreground hover:border-muted/50"
                  }`}
                >
                  <Icon
                    name={ACCOUNT_TYPE_ICONS[preset.type]}
                    className="h-4 w-4 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {preset.name}
                  </span>
                  {on ? (
                    <Icon name="check" className="h-4 w-4 shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-2 border-t border-border pt-5">
            <Field label="Something else?" htmlFor="custom-name">
              <TextInput
                id="custom-name"
                placeholder="Coin jar"
                value={custom.name}
                maxLength={MAX_ACCOUNT_NAME}
                onChange={(event) =>
                  setCustom((c) => ({ ...c, name: event.target.value }))
                }
                onKeyDown={(event) => {
                  // Enter here means "add this one", not "submit the step".
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCustom();
                  }
                }}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Select
                aria-label="Type of account"
                value={custom.type}
                onChange={(event) =>
                  setCustom((c) => ({
                    ...c,
                    type: event.target.value as AccountType,
                  }))
                }
                className="h-10 flex-1"
              >
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ACCOUNT_TYPE_LABELS[type]} — {ACCOUNT_TYPE_BLURBS[type]}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={addCustom}
                disabled={custom.name.trim() === ""}
              >
                <Icon name="plus" className="h-4 w-4" />
                Add
              </Button>
            </div>
          </div>

          {chosen.length > 0 ? (
            <p className="text-sm text-muted">
              Adding{" "}
              <span className="font-medium text-foreground">
                {chosen.map((entry) => entry.name).join(", ")}
              </span>
              .
            </p>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            {/* Closing without answering leaves the flag unset, so the prompt
                comes back next session — "later" means later, not never. An
                account can still be added from Overview in the meantime. */}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending !== null}
            >
              I&apos;ll do this later
            </Button>
            <Button
              type="button"
              onClick={() => setStep("balances")}
              disabled={chosen.length === 0 || pending !== null}
            >
              Continue
            </Button>
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="What's in each one?"
      description="Enter what each account holds today. Leaving one blank just means it's empty — and you can correct any of them later."
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {chosen.map((entry, index) => (
          <Field
            key={entry.key}
            label={entry.name}
            htmlFor={`opening-${entry.key}`}
            hint={
              isDebt(entry.type)
                ? "How much you still owe on it"
                : ACCOUNT_TYPE_BLURBS[entry.type]
            }
          >
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
              >
                <Icon
                  name={ACCOUNT_TYPE_ICONS[entry.type]}
                  className="h-4.5 w-4.5"
                />
              </span>
              <TextInput
                id={`opening-${entry.key}`}
                autoFocus={index === 0}
                inputMode="decimal"
                placeholder="0.00"
                value={entry.balance}
                onChange={(event) =>
                  setChosen((current) =>
                    current.map((row) =>
                      row.key === entry.key
                        ? { ...row, balance: event.target.value }
                        : row,
                    ),
                  )
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
          {existing.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep("choose")}
              disabled={pending !== null}
            >
              Back
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={pending !== null}
            >
              {pending === "skip" ? "Saving…" : "Start at zero"}
            </Button>
          )}
          <Button type="submit" disabled={pending !== null}>
            {pending === "save" ? "Setting up…" : "Finish setup"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
