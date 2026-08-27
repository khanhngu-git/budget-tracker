"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { categoryLabel } from "@/lib/budget/categories";
import { Section } from "@/components/dashboard/section";
import { RecurringDialog } from "@/components/dashboard/recurring-dialog";
import { RecurringManager } from "@/components/dashboard/recurring-manager";
import { TransactionDialog } from "@/components/dashboard/transaction-dialog";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { summariseMonth } from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import {
  formatMonthLabel,
  formatMoney,
  formatSignedMoney,
} from "@/lib/budget/format";
import type {
  RecurringRule,
  Transaction,
  TransactionKind,
} from "@/lib/budget/types";

/**
 * `useSearchParams` opts its whole subtree out of static prerendering, so the
 * page is split: this shell stays static and the filtered list suspends.
 */
export default function TransactionsPage() {
  return (
    <Suspense fallback={null}>
      <TransactionsView />
    </Suspense>
  );
}

function TransactionsView() {
  const {
    uid,
    liveAccounts,
    accountsById,
    transactions,
    settledTransactions,
    balancesAsOf,
    recurring,
    recurringLoading,
    loading,
    monthStart,
    setMonthStart,
  } = useBudgetContext();
  // null means the dialog is closed; { transaction: null } means "adding".
  const [dialog, setDialog] = useState<{
    transaction: Transaction | null;
  } | null>(null);
  const [managing, setManaging] = useState(false);
  const [editingRule, setEditingRule] = useState<RecurringRule | null>(null);

  // Arrived here from an account card on the Overview. Held in the URL rather
  // than in state so the filtered view is a real place: it survives a reload
  // and the back button undoes it.
  const accountId = useSearchParams().get("account");
  const focused = accountId ? (accountsById[accountId] ?? null) : null;

  // Search and kind live in component state rather than the URL: they are a
  // way of reading this month, not a place you would link someone to, and
  // putting every keystroke in the history would make Back useless.
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<TransactionKind | "">("");

  const term = query.trim().toLowerCase();
  const matches = (entry: Transaction) => {
    if (focused && entry.accountId !== focused.id && entry.toAccountId !== focused.id) {
      return false;
    }
    if (kind && entry.kind !== kind) return false;
    if (term === "") return true;

    // Searched against what the row actually shows — the note, the category
    // and the accounts — so what you type matches what you can see.
    const haystack = [
      entry.note,
      categoryLabel(entry.categoryId),
      accountsById[entry.accountId]?.name ?? "",
      entry.toAccountId ? (accountsById[entry.toAccountId]?.name ?? "") : "",
      (entry.amountCents / 100).toFixed(2),
    ]
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  };

  const visible = transactions.filter(matches);
  const filtering = term !== "" || kind !== "" || focused !== null;

  // Built from what has actually happened. A bill dated for the 30th is in
  // the list below but not in this line: it hasn't been paid yet, and a net
  // that already counted it would be answering a different question.
  const visibleSettled = settledTransactions.filter(matches);
  const { incomeCents, expenseCents, netCents } = summariseMonth(visibleSettled);
  const upcomingCount = visible.length - visibleSettled.length;
  const monthLabel = formatMonthLabel(monthStart);

  return (
    <>
      <Section
        title={focused ? `${focused.name} in ${monthLabel}` : `Everything in ${monthLabel}`}
        // This page is the ledger, not a dashboard. The month's shape belongs
        // on Statistics, where there's room to explain it; here it's one line
        // so the entries start as high up the page as possible.
        subtitle={
          visible.length === 0 ? (
            focused
              ? `Nothing recorded against ${focused.name} this month.`
              : "Nothing recorded this month."
          ) : (
            <>
              {visible.length} {visible.length === 1 ? "entry" : "entries"} ·{" "}
              {formatMoney(incomeCents)} in, {formatMoney(expenseCents)} out ·{" "}
              {/* The net is the verdict on the month, so it wears the verdict's
                  colour — you shouldn't have to read the minus sign to know
                  which way it went. */}
              <span
                className={`font-medium ${
                  netCents > 0
                    ? "text-positive"
                    : netCents < 0
                      ? "text-negative"
                      : "text-foreground"
                }`}
              >
                {formatSignedMoney(netCents)}
              </span>{" "}
              net
              {/* Named, not silently omitted: the entry count above includes
                  them, so the gap between the two needs explaining. */}
              {upcomingCount > 0 ? (
                <span className="text-muted"> · {upcomingCount} upcoming</span>
              ) : null}
            </>
          )
        }
        action={
          <div className="flex items-center gap-2">
            {/* Only offered once there's something to manage — an empty list
                behind a button nobody can fill from here is just a dead end. */}
            {recurring.length > 0 ? (
              <Button
                variant="outline"
                onClick={() => setManaging(true)}
                disabled={!uid}
              >
                <Icon name="repeat" className="h-4 w-4" />
                Recurring
                <span className="tabular-nums text-muted">
                  {recurring.length}
                </span>
              </Button>
            ) : null}
            <Button
              onClick={() => setDialog({ transaction: null })}
              disabled={!uid}
            >
              <Icon name="plus" className="h-4 w-4" />
              Add entry
            </Button>
          </div>
        }
      >
        {/* Any active filter says so in the page, with the way out attached —
            a list quietly showing a third of the month is how people conclude
            their entries have vanished. */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            >
              <Icon name="search" className="h-4 w-4" />
            </span>
            <TextInput
              type="search"
              aria-label="Search entries"
              placeholder="Search notes, categories, accounts, amounts"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Filter by kind"
            value={kind}
            options={[
              { value: "", label: "All kinds" },
              { value: "income", label: "Income", icon: "banknote" },
              { value: "expense", label: "Expenses", icon: "bag" },
              { value: "transfer", label: "Transfers", icon: "swap" },
              { value: "gain", label: "Gains", icon: "trendUp" },
              { value: "loss", label: "Losses", icon: "trendDown" },
            ]}
            onChange={(next) => setKind(next as TransactionKind | "")}
            className="sm:w-48"
          />
        </div>

        {filtering ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted">
              {visible.length} of {transactions.length}{" "}
              {transactions.length === 1 ? "entry" : "entries"}
              {focused ? (
                <>
                  {" "}
                  touching{" "}
                  <span className="font-medium text-foreground">
                    {focused.name}
                  </span>
                </>
              ) : null}
            </span>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setKind("");
              }}
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
            >
              <Icon name="close" className="h-3.5 w-3.5" />
              Clear
            </button>
            {focused ? (
              <Link
                href="/dashboard/transactions"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
                All accounts
              </Link>
            ) : null}
          </div>
        ) : null}

        <TransactionList
          uid={uid}
          transactions={visible}
          asOf={balancesAsOf}
          accounts={accountsById}
          loading={loading}
          onEdit={(transaction) => setDialog({ transaction })}
        />
      </Section>

      <RecurringManager
        uid={uid}
        rules={recurring}
        accounts={accountsById}
        loading={recurringLoading}
        open={managing}
        onClose={() => setManaging(false)}
        onEdit={(rule) => setEditingRule(rule)}
      />

      {/* A sibling of the manager, not a child: the edit form opens over the
          list and closing it returns to the list, still open. */}
      {uid && editingRule ? (
        <RecurringDialog
          // Remounts per rule so the form opens on that rule's own values.
          key={editingRule.id}
          uid={uid}
          accounts={liveAccounts}
          rule={editingRule}
          open
          onClose={() => setEditingRule(null)}
        />
      ) : null}

      {uid && dialog ? (
        <TransactionDialog
          // Remounts per entry so the form opens on that entry's own values.
          key={dialog.transaction?.id ?? "new"}
          uid={uid}
          accounts={liveAccounts}
          transaction={dialog.transaction}
          monthStart={monthStart}
          onMonthChange={setMonthStart}
          open
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
