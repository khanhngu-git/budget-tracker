"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { checkAllocation, allocationOf } from "@/lib/budget/analytics";
import { CategoryPicker } from "@/components/dashboard/category-picker";
import { categoriesFor } from "@/lib/budget/categories";
import {
  formatMoney,
  formatPercent,
  parseAmountToCents,
} from "@/lib/budget/format";
import { writeErrorMessage } from "@/lib/budget/error";
import { setGoal, type GoalMap } from "@/lib/budget/goals";
import { goalId, type Goal, type GoalScope } from "@/lib/budget/types";
import { SCOPE_REQUIREMENT } from "@/lib/budget/scopes";

/**
 * The five kinds of goal, each stated as the sentence it completes.
 *
 * A row of four-letter tabs — "Earn / Save / Invest / Limit" — made the reader
 * guess what each one measured, and at 11px they read as decoration rather
 * than as the most important choice on the form. Full rows with a line of
 * explanation cost vertical space and buy the question being answered once.
 */
const SCOPE_TABS: {
  value: GoalScope;
  label: string;
  blurb: string;
  icon: IconName;
}[] = [
  {
    value: "income",
    label: "Earn",
    blurb: "What you expect to bring in",
    icon: "banknote",
  },
  {
    value: "savings",
    label: "Save",
    blurb: "Money you move into savings",
    icon: "vault",
  },
  {
    value: "investments",
    label: "Invest",
    blurb: "Money you move into investments",
    icon: "trendUp",
  },
  {
    value: "debt",
    label: "Pay off",
    blurb: "What you clear off a loan or card",
    icon: "debt",
  },
  {
    value: "expense",
    label: "Spending limit",
    blurb: "A ceiling on one category",
    icon: "bag",
  },
];

const SCOPE_HINT: Record<GoalScope, string> = {
  income: "The least you mean to bring in this month.",
  savings: "How much you mean to move into Savings this month.",
  investments: "How much you mean to move into Investments this month.",
  debt: "How much you mean to pay off what you owe this month.",
  expense: "The most you want to spend on this category this month.",
};

/**
 * Sets any of the four kinds of goal.
 *
 * Mount with a `key` tied to the goal being edited so the form opens on that
 * goal's own values.
 */
export function GoalDialog({
  uid,
  monthKey,
  monthLabel,
  goals,
  goal,
  initialScope,
  scopes,
  open,
  onClose,
}: {
  uid: string;
  /** The month this goal belongs to — plans don't carry across months. */
  monthKey: string;
  monthLabel: string;
  goals: GoalMap;
  /** null when adding. */
  goal: Goal | null;
  /** Which tab a fresh form opens on, when the caller knows. */
  initialScope?: GoalScope;
  /** The kinds of goal this user has the accounts to measure. */
  scopes: Set<GoalScope>;
  open: boolean;
  onClose: () => void;
}) {
  const expenseCategories = categoriesFor("expense");
  const editing = goal !== null;

  // Never opens on a tab the user can't use — including when the caller asked
  // for one, since it can't know what accounts exist.
  const firstUsable =
    SCOPE_TABS.find((tab) => scopes.has(tab.value))?.value ?? "income";
  const [scope, setScope] = useState<GoalScope>(
    goal?.scope ??
      (initialScope && scopes.has(initialScope) ? initialScope : firstUsable),
  );
  const [categoryId, setCategoryId] = useState(
    () =>
      goal?.categoryId ??
      // Default to a category that isn't budgeted yet, so adding never
      // silently overwrites a limit the user already set.
      (expenseCategories.find(
        (category) => goals[goalId("expense", category.id)] === undefined,
      ) ?? expenseCategories[0]).id,
  );
  const [amount, setAmount] = useState(() =>
    goal ? (goal.amountCents / 100).toFixed(2) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const budgeted = new Set(
    Object.values(goals)
      .filter((entry) => entry.scope === "expense" && entry.categoryId)
      .map((entry) => entry.categoryId as string),
  );

  const existing =
    goals[goalId(scope, scope === "expense" ? categoryId : null)];
  const wouldReplace = !editing && existing !== undefined;

  // What's left to promise, counting back whatever this goal already claims.
  const { incomeTargetCents, unallocatedCents } = allocationOf(goals);
  const headroomCents =
    scope === "income"
      ? unallocatedCents
      : unallocatedCents + (existing?.amountCents ?? 0);

  // The same figure the goal cards show, computed live so the reader sees what
  // slice of their income they're committing while they're still typing it.
  const typedCents = parseAmountToCents(amount);
  const shareOfIncome =
    scope === "income" || typedCents === null || !incomeTargetCents
      ? null
      : typedCents / incomeTargetCents;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountCents = parseAmountToCents(amount);
    if (amountCents === null) {
      setError("Enter an amount like 400.00.");
      return;
    }

    // Everything except income is spent out of the income target, so the
    // total of what's promised can never exceed what's expected to come in.
    const conflict = checkAllocation(
      goals,
      scope,
      scope === "expense" ? categoryId : null,
      amountCents,
    );
    if (conflict) {
      setError(conflict);
      return;
    }

    if (!scopes.has(scope)) {
      setError(SCOPE_REQUIREMENT[scope]);
      return;
    }

    setError(null);
    setPending(true);
    try {
      await setGoal(
        uid,
        monthKey,
        scope,
        scope === "expense" ? categoryId : null,
        amountCents,
      );
      onClose();
    } catch (caught) {
      setError(
        writeErrorMessage(caught, "Couldn't save that goal. Please try again."),
      );
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit goal" : "New goal"}
      description={`This goal applies to ${monthLabel} only — each month carries its own plan.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {editing ? null : (
          <div
            role="radiogroup"
            aria-label="Goal type"
            className="flex flex-col gap-1.5"
          >
            {SCOPE_TABS.map((tab) => {
              // Shown but unpickable, with the reason in place of the blurb:
              // hiding it would leave the user wondering where paying-off
              // went, while this points at the account they'd need to add.
              const usable = scopes.has(tab.value);
              const current = scope === tab.value;

              return (
                <button
                  key={tab.value}
                  type="button"
                  role="radio"
                  aria-checked={current}
                  onClick={() => setScope(tab.value)}
                  disabled={pending || !usable}
                  className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    current
                      ? "border-accent bg-accent/10"
                      : usable
                        ? "border-border hover:border-muted/50 hover:bg-surface-muted"
                        : "cursor-not-allowed border-border opacity-50"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      current
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-muted text-muted"
                    }`}
                  >
                    <Icon name={tab.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {tab.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {usable ? tab.blurb : SCOPE_REQUIREMENT[tab.value]}
                    </span>
                  </span>
                  {current ? (
                    <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {scope === "expense" ? (
          <Field
            label="Category"
            htmlFor="goal-category"
            hint={
              editing
                ? "A limit stays with the category it was set for."
                : undefined
            }
          >
            <CategoryPicker
              id="goal-category"
              flow="expense"
              value={categoryId}
              onChange={setCategoryId}
              disabled={pending || editing}
              // Marked rather than hidden: seeing that Groceries is already
              // budgeted is the answer to "why can't I add it again?".
              takenIds={editing ? undefined : budgeted}
              takenNote="Already budgeted"
            />
          </Field>
        ) : null}

        <Field
          label={scope === "expense" ? "Monthly limit" : "Monthly target"}
          htmlFor="goal-amount"
          hint={
            wouldReplace
              ? `Already set to ${formatMoney(existing.amountCents)} (${
                  shareOfIncome === null
                    ? "no income target yet"
                    : `you're entering ${formatPercent(shareOfIncome)} of income`
                }) — saving replaces it.`
              : shareOfIncome !== null
                ? `That's ${formatPercent(
                    shareOfIncome,
                  )} of your income target. ${formatMoney(
                    Math.max(0, headroomCents),
                  )} of it is still unallocated.`
                : scope !== "income" && incomeTargetCents !== null
                  ? `${SCOPE_HINT[scope]} ${formatMoney(
                      Math.max(0, headroomCents),
                    )} of your income target is still unallocated.`
                  : SCOPE_HINT[scope]
          }
        >
          <TextInput
            id="goal-amount"
            autoFocus
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            disabled={pending}
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
            {pending ? "Saving…" : "Save goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
