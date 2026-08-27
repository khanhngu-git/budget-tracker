"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Icon } from "@/components/ui/icon";
import { ACCOUNT_PRESETS, MAX_ACCOUNT_NAME } from "@/lib/budget/accounts";
import { BudgetError } from "@/lib/budget/error";
import {
  formatMoney,
  monthKey,
  parseAmountToCents,
  parseBalanceToCents,
} from "@/lib/budget/format";
import { setGoal } from "@/lib/budget/goals";
import { availableScopes } from "@/lib/budget/scopes";
import { markOpeningBalancesSet } from "@/lib/budget/profile";
import { updateProfile } from "firebase/auth";
import { useAuth } from "@/lib/auth/auth-context";
import { MAX_DISPLAY_NAME, savePreferences } from "@/lib/settings/preferences";
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

/**
 * Where you are, and how much is left.
 *
 * Three unlabelled screens in a row read as an open-ended interrogation; the
 * same three with "Step 2 of 3" on them read as a short task. It is the
 * cheapest thing that makes a multi-step form feel finite.
 */
function Steps({ labels, current }: { labels: string[]; current: number }) {
  return (
    <ol
      className="flex items-center gap-2"
      aria-label={`Step ${current} of ${labels.length}`}
    >
      {labels.map((label, index) => {
        const position = index + 1;
        const done = position < current;
        const active = position === current;

        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                active
                  ? "bg-foreground text-background"
                  : done
                    ? "bg-accent text-accent-foreground"
                    : "bg-surface-muted text-muted"
              }`}
            >
              {done ? <Icon name="check" className="h-3.5 w-3.5" /> : position}
            </span>
            <span
              className={`hidden truncate text-xs font-medium sm:block ${
                active ? "text-foreground" : "text-muted"
              }`}
            >
              {label}
            </span>
            {position < labels.length ? (
              <span aria-hidden className="h-px flex-1 bg-border" />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

let sequence = 0;
function chosenFrom(name: string, type: AccountType): Chosen {
  sequence += 1;
  return { key: `new-${sequence}`, name, type, balance: "" };
}

/**
 * The first thing a new account sees: which accounts do you keep money in, and
 * what's in them?
 *
 * Three steps, because they are three different questions. Naming your accounts
 * is a decision; typing in balances is copying figures off statements; setting
 * a budget is a plan. Asked together they read as one long form, and being
 * asked for a number next to an account you haven't decided you want yet is
 * what made the combined version feel like paperwork.
 *
 * Nothing is written until the balances step, so backing out before it leaves
 * no half-built set of accounts behind. The budget step comes *after* that
 * write, so abandoning it costs nothing either — the accounts are already
 * safe, and a plan can be made any time from the Budget tab.
 */
export function OnboardingDialog({
  uid,
  existing,
  knownName,
  open,
  onClose,
}: {
  uid: string;
  /** Accounts already on the books — non-empty only for an older account. */
  existing: Account[];
  /**
   * What we can already call them, or "" if we can't.
   *
   * Signing up with an email address asks for a name on the form; signing in
   * with Google never does, and the profile it hands back doesn't always carry
   * one. So the question is asked here instead — before anything else, because
   * every screen after this one greets them by name.
   */
  knownName: string;
  open: boolean;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState(knownName);
  // Asked once, on the way in. Editing it later is Settings' job.
  const [needsName] = useState(knownName.trim() === "");

  // Someone who already has accounts has answered the first question already;
  // all that's left for them is the balances.
  const [step, setStep] = useState<"name" | "choose" | "balances" | "budget">(
    needsName ? "name" : existing.length > 0 ? "balances" : "choose",
  );

  const STEP_LABELS = needsName
    ? ["Name", "Accounts", "Balances", "Budget"]
    : ["Accounts", "Balances", "Budget"];
  /** The 1-based position of a step, given whether the name step is present. */
  const at = (base: 1 | 2 | 3) => (needsName ? base + 1 : base);
  const [chosen, setChosen] = useState<Chosen[]>(() => {
    if (existing.length > 0) {
      return existing.map((account) => ({
        key: account.id,
        id: account.id,
        name: account.name,
        type: account.type,
        balance: "",
      }));
    }
    // Nearly everyone has one, and starting from a blank grid makes the first
    // screen a puzzle rather than a confirmation. Ticked, not fixed — clicking
    // it again removes it like any other preset.
    const debit = ACCOUNT_PRESETS.find((preset) => preset.name === "Debit Account");
    return debit ? [chosenFrom(debit.name, debit.type)] : [];
  });
  const [incomeTarget, setIncomeTarget] = useState("");
  const [custom, setCustom] = useState<{ name: string; type: AccountType }>({
    name: "",
    type: "cash",
  });
  // The custom form is a detour most people never take, so it stays folded
  // away behind its own tile rather than sitting under every preset as a
  // permanent second question.
  const [customOpen, setCustomOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "skip" | null>(null);

  const picked = (name: string) =>
    chosen.some((entry) => entry.name.toLowerCase() === name.toLowerCase());

  /** Whether a chosen account came from the grid, which already shows it. */
  const isPreset = (name: string) =>
    ACCOUNT_PRESETS.some(
      (preset) => preset.name.toLowerCase() === name.toLowerCase(),
    );

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
    setCustomOpen(false);
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
      // The accounts are on the books from here on, so the last step is
      // genuinely optional — closing on it loses nothing.
      setPending(null);
      setStep("budget");
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

  /**
   * The plan, reduced to the one figure the rest of it hangs off.
   *
   * Every other goal in the app is budgeted out of the income target, so it is
   * the only one that can be set before anything else exists — and asking for
   * spending limits here, before the user has recorded a single transaction,
   * would be asking them to guess.
   */
  async function handleBudget(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmountToCents(incomeTarget);
    if (amountCents === null) {
      setError("Enter an amount like 4000.00.");
      return;
    }

    setError(null);
    setPending("save");
    try {
      await setGoal(uid, monthKey(new Date()), "income", null, amountCents);
      onClose();
    } catch {
      setError("Couldn't save that target. Please try again.");
      setPending(null);
    }
  }

  async function handleName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim().slice(0, MAX_DISPLAY_NAME);
    if (trimmed === "") {
      setError("Tell us what to call you.");
      return;
    }

    setError(null);
    setPending("save");
    try {
      await savePreferences(uid, { displayName: trimmed });
      // Firebase Auth keeps its own copy, and it's the one that survives into
      // anything reading the session rather than the profile document.
      if (user && user.displayName !== trimmed) {
        await updateProfile(user, { displayName: trimmed });
      }
      setPending(null);
      setStep(existing.length > 0 ? "balances" : "choose");
    } catch {
      setError("Couldn't save that. Please try again.");
      setPending(null);
    }
  }

  if (step === "name") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        dismissible={false}
        title="What should we call you?"
      >
        <form onSubmit={handleName} className="flex flex-col gap-4">
          <Steps labels={STEP_LABELS} current={1} />

          <Field label="Your name" htmlFor="onboarding-name">
            <TextInput
              id="onboarding-name"
              autoFocus
              placeholder="Alex"
              value={name}
              maxLength={MAX_DISPLAY_NAME}
              onChange={(event) => setName(event.target.value)}
              disabled={pending !== null}
              required
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

          <div className="flex justify-end">
            <Button type="submit" disabled={pending !== null || name.trim() === ""}>
              {pending === "save" ? "Saving…" : "Continue"}
            </Button>
          </div>
        </form>
      </Dialog>
    );
  }

  if (step === "budget") {
    // Built from what was just chosen, so the note below names only the kinds
    // of goal this user will actually be offered.
    const scopes = availableScopes(
      chosen.map((entry) => ({
        id: entry.key,
        name: entry.name,
        type: entry.type,
        balanceCents: 0,
        order: 0,
        targetCents: null,
      })),
    );
    const building = [
      scopes.has("savings") ? "savings" : null,
      scopes.has("investments") ? "investing" : null,
    ].filter(Boolean) as string[];

    return (
      <Dialog
        open={open}
        onClose={onClose}
        dismissible={false}
        title="What do you expect to earn?"
        description="One figure to start your plan from. Everything else you budget is measured against it."
      >
        <form onSubmit={handleBudget} className="flex flex-col gap-4">
          <Steps labels={STEP_LABELS} current={at(3)} />

          <Field
            label="Monthly income target"
            htmlFor="onboarding-income"
            hint={
              parseAmountToCents(incomeTarget) === null
                ? "Roughly what lands in your accounts each month, after tax."
                : `${formatMoney(
                    parseAmountToCents(incomeTarget) as number,
                  )} a month. You can change this whenever you like.`
            }
          >
            <TextInput
              id="onboarding-income"
              autoFocus
              inputMode="decimal"
              placeholder="4000.00"
              value={incomeTarget}
              onChange={(event) => setIncomeTarget(event.target.value)}
              disabled={pending !== null}
            />
          </Field>

          <p className="rounded-xl border border-border bg-surface-muted px-3 py-2.5 text-sm text-muted">
            Next, from the Budget tab, you can cap what you spend per category
            {building.length > 0 ? ` and set ${building.join(" and ")} targets` : ""}
            . Each month keeps its own plan.
          </p>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            {/* The accounts are already saved by this point, so skipping here
                genuinely finishes setup rather than abandoning it. */}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending !== null}
            >
              Set this up later
            </Button>
            <Button type="submit" disabled={pending !== null}>
              {pending === "save" ? "Saving…" : "Finish setup"}
            </Button>
          </div>
        </form>
      </Dialog>
    );
  }

  if (step === "choose") {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        dismissible={false}
        title="Where do you keep your money?"
        description="Pick everything that applies. You can rename these or add more at any time."
      >
        <div className="flex flex-col gap-5">
          <Steps labels={STEP_LABELS} current={at(1)} />

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
                  {on ? <Icon name="check" className="h-4 w-4 shrink-0" /> : null}
                </button>
              );
            })}

            {/* Last in the grid rather than a permanent form beneath it: "none
                of these" is a detour most people never take, and asking the
                question on every screen made the step look twice as long. */}
            <button
              type="button"
              onClick={() => setCustomOpen((wasOpen) => !wasOpen)}
              aria-expanded={customOpen}
              className={`flex items-center gap-2.5 rounded-xl border border-dashed px-3 py-2.5 text-left transition-colors ${
                customOpen
                  ? "border-foreground text-foreground"
                  : "border-border text-muted hover:border-muted/50 hover:text-foreground"
              }`}
            >
              <Icon name="plus" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                Custom
              </span>
            </button>
          </div>

          {customOpen ? (
            <div className="flex flex-col gap-2 border-t border-border pt-5">
              <Field label="Name it" htmlFor="custom-name">
                <TextInput
                  id="custom-name"
                  autoFocus
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
                  options={ACCOUNT_TYPES.map((type) => ({
                    value: type,
                    label: ACCOUNT_TYPE_LABELS[type],
                    icon: ACCOUNT_TYPE_ICONS[type],
                  }))}
                  onChange={(type) =>
                    setCustom((c) => ({ ...c, type: type as AccountType }))
                  }
                  className="flex-1"
                />
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
          ) : null}

          {/* Only the ones added by hand need listing — a ticked preset already
              shows its own state in the grid above, and repeating all of them
              underneath was the same information twice. */}
          {chosen.some((entry) => !isPreset(entry.name)) ? (
            <div className="flex flex-wrap gap-1.5">
              {chosen
                .filter((entry) => !isPreset(entry.name))
                .map((entry) => (
                  <span
                    key={entry.key}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-muted px-2 py-1 text-xs font-medium text-foreground"
                  >
                    <Icon
                      name={ACCOUNT_TYPE_ICONS[entry.type]}
                      className="h-3.5 w-3.5 text-muted"
                    />
                    {entry.name}
                    <button
                      type="button"
                      aria-label={`Remove ${entry.name}`}
                      onClick={() =>
                        setChosen((current) =>
                          current.filter((row) => row.key !== entry.key),
                        )
                      }
                      className="text-muted transition-colors hover:text-foreground"
                    >
                      <Icon name="close" className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
            </div>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          {/* No way past this step without an account. The app cannot record a
              single thing without one, so "later" would only hand someone an
              empty dashboard and no hint as to why nothing works. */}
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-muted">
              {chosen.length === 0
                ? "Pick at least one to continue."
                : `${chosen.length} selected.`}
            </p>
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
      dismissible={false}
      title="What's in each one?"
      description="Enter what each account holds today. Leaving one blank just means it's empty — and you can correct any of them later."
    >
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        <Steps labels={STEP_LABELS} current={at(2)} />

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
            {pending === "save" ? "Saving…" : "Continue"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
