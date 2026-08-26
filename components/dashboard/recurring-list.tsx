"use client";

import { useState } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { categoryIcon, categoryLabel } from "@/lib/budget/categories";
import { formatDayLong, formatMoney } from "@/lib/budget/format";
import {
  FREQUENCY_EVERY,
  nextOccurrence,
} from "@/lib/budget/recurrence";
import {
  deleteRecurringRule,
  setRecurringActive,
} from "@/lib/budget/recurring";
import type { Account, RecurringRule } from "@/lib/budget/types";

type AccountLookup = Record<string, Account>;

function nameOf(accounts: AccountLookup, id: string | null): string {
  if (!id) return "—";
  return accounts[id]?.name ?? "Closed account";
}

function describe(rule: RecurringRule, accounts: AccountLookup): string {
  if (rule.kind === "transfer") {
    return `${nameOf(accounts, rule.accountId)} → ${nameOf(
      accounts,
      rule.toAccountId,
    )}`;
  }
  return categoryLabel(rule.categoryId);
}

function iconFor(rule: RecurringRule): IconName {
  return rule.kind === "transfer" ? "swap" : categoryIcon(rule.categoryId);
}

function amountDisplay(rule: RecurringRule) {
  switch (rule.kind) {
    case "income":
      return { text: `+${formatMoney(rule.amountCents)}`, tone: "text-positive" };
    case "expense":
      return { text: `−${formatMoney(rule.amountCents)}`, tone: "text-foreground" };
    default:
      return { text: formatMoney(rule.amountCents), tone: "text-muted" };
  }
}

/**
 * When this rule will next act, said plainly.
 *
 * A schedule the user can't audit is a schedule they won't trust with the
 * rent, so the line answers the only two questions worth asking of one: how
 * often, and when next.
 */
function scheduleLine(rule: RecurringRule, now: Date): string {
  const every = FREQUENCY_EVERY[rule.frequency];
  if (!rule.active) return `Paused · ${every}`;

  const next = nextOccurrence(rule, now);
  if (!next) return `${every} · finished`;

  return `${every} · next ${formatDayLong(next)}`;
}

export function RecurringList({
  uid,
  rules,
  accounts,
  loading,
  onEdit,
}: {
  uid: string | null;
  rules: RecurringRule[];
  accounts: AccountLookup;
  loading: boolean;
  onEdit: (rule: RecurringRule) => void;
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Read once per render pass rather than per row, so every line in the list
  // is answering "next when?" against the same moment.
  const now = new Date();

  async function act(ruleId: string, run: (owner: string) => Promise<void>) {
    if (!uid) return;
    setError(null);
    setPendingId(ruleId);
    try {
      await run(uid);
      setConfirmingId(null);
    } catch {
      setError("Couldn't update that schedule. Please try again.");
    } finally {
      setPendingId(null);
    }
  }

  if (loading) {
    return (
      <p className="rounded-2xl border border-border bg-surface p-6 text-sm text-muted">
        Loading recurring entries…
      </p>
    );
  }

  if (rules.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No recurring entries yet
        </p>
        <p className="mt-1 text-sm text-muted">
          Add an entry and set it to repeat — a salary, the rent, a
          subscription — and it will show up here.
        </p>
      </div>
    );
  }

  const iconButton =
    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
        {rules.map((rule) => {
          const amount = amountDisplay(rule);
          const label = describe(rule, accounts);
          const confirming = confirmingId === rule.id;
          const pending = pendingId === rule.id;

          return (
            <li
              key={rule.id}
              className={`flex items-center gap-3 px-4 py-3.5 sm:gap-4 sm:px-5 ${
                rule.active ? "" : "opacity-60"
              }`}
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
              >
                <Icon name={iconFor(rule)} className="h-4.5 w-4.5" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {rule.note || label}
                </p>
                <p className="truncate text-xs text-muted">
                  {rule.note ? `${label} · ` : ""}
                  {scheduleLine(rule, now)}
                </p>
              </div>

              {confirming ? (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="hidden text-xs text-muted sm:inline">
                    Stop this schedule?
                  </span>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    disabled={pending}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted transition-colors hover:text-foreground disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      act(rule.id, (owner) => deleteRecurringRule(owner, rule.id))
                    }
                    disabled={pending}
                    className="rounded-md bg-negative px-2.5 py-1 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {pending ? "Deleting…" : "Delete"}
                  </button>
                </div>
              ) : (
                <>
                  <div
                    className={`shrink-0 text-sm font-medium tabular-nums ${amount.tone}`}
                  >
                    {amount.text}
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {/* Pausing is the answer to "not this month" — deleting
                        would lose the rule and everything set up with it. */}
                    <button
                      type="button"
                      onClick={() =>
                        act(rule.id, (owner) =>
                          setRecurringActive(owner, rule.id, !rule.active),
                        )
                      }
                      disabled={!uid || pending}
                      aria-label={
                        rule.active
                          ? `Pause ${rule.note || label}`
                          : `Resume ${rule.note || label}`
                      }
                      title={rule.active ? "Pause" : "Resume"}
                      className={`${iconButton} hover:text-foreground`}
                    >
                      <Icon
                        name={rule.active ? "close" : "repeat"}
                        className="h-4 w-4"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => onEdit(rule)}
                      disabled={!uid}
                      aria-label={`Edit ${rule.note || label}`}
                      className={`${iconButton} hover:text-foreground`}
                    >
                      <Icon name="pencil" className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setConfirmingId(rule.id);
                      }}
                      disabled={!uid}
                      aria-label={`Delete ${rule.note || label}`}
                      className={`${iconButton} hover:text-negative`}
                    >
                      <Icon name="trash" className="h-4 w-4" />
                    </button>
                  </div>
                </>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
