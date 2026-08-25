"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Select, TextInput } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { checkAllocation, allocationOf } from "@/lib/budget/analytics";
import { categoriesFor } from "@/lib/budget/categories";
import { formatMoney, parseAmountToCents } from "@/lib/budget/format";
import { setGoal, type GoalMap } from "@/lib/budget/goals";
import { goalId, type Goal, type GoalScope } from "@/lib/budget/types";

const SCOPE_TABS: { value: GoalScope; label: string; icon: IconName }[] = [
  { value: "income", label: "Earn", icon: "banknote" },
  { value: "savings", label: "Save", icon: "vault" },
  { value: "investments", label: "Invest", icon: "trendUp" },
  { value: "expense", label: "Limit", icon: "bag" },
];

const SCOPE_HINT: Record<GoalScope, string> = {
  income: "The least you mean to bring in this month.",
  savings: "How much you mean to move into Savings this month.",
  investments: "How much you mean to move into Investments this month.",
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
  open: boolean;
  onClose: () => void;
}) {
  const expenseCategories = categoriesFor("expense");
  const editing = goal !== null;

  const [scope, setScope] = useState<GoalScope>(goal?.scope ?? "income");
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

  const existing =
    goals[goalId(scope, scope === "expense" ? categoryId : null)];
  const wouldReplace = !editing && existing !== undefined;

  // What's left to promise, counting back whatever this goal already claims.
  const { incomeTargetCents, unallocatedCents } = allocationOf(goals);
  const headroomCents =
    scope === "income"
      ? unallocatedCents
      : unallocatedCents + (existing?.amountCents ?? 0);

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
    } catch {
      setError("Couldn't save that goal. Please try again.");
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
            className="grid grid-cols-4 gap-1 rounded-lg border border-border p-1"
          >
            {SCOPE_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                role="radio"
                aria-checked={scope === tab.value}
                onClick={() => setScope(tab.value)}
                disabled={pending}
                className={`inline-flex h-9 flex-col items-center justify-center gap-0.5 rounded-md text-[0.6875rem] font-medium transition-colors ${
                  scope === tab.value
                    ? "bg-foreground text-background"
                    : "text-muted hover:text-foreground"
                }`}
              >
                <Icon name={tab.icon} className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {scope === "expense" ? (
          <Field label="Category" htmlFor="goal-category">
            <Select
              id="goal-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              disabled={pending || editing}
            >
              {expenseCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        <Field
          label={scope === "expense" ? "Monthly limit" : "Monthly target"}
          htmlFor="goal-amount"
          hint={
            wouldReplace
              ? `Already set to ${formatMoney(existing.amountCents)} — saving replaces it.`
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
