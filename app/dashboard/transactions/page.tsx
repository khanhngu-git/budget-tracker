"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
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
import type { RecurringRule, Transaction } from "@/lib/budget/types";

export default function TransactionsPage() {
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

  // Built from what has actually happened. A bill dated for the 30th is in
  // the list below but not in this line: it hasn't been paid yet, and a net
  // that already counted it would be answering a different question.
  const { incomeCents, expenseCents, netCents } =
    summariseMonth(settledTransactions);
  const upcomingCount = transactions.length - settledTransactions.length;
  const monthLabel = formatMonthLabel(monthStart);

  return (
    <>
      <Section
        title={`Everything in ${monthLabel}`}
        // This page is the ledger, not a dashboard. The month's shape belongs
        // on Statistics, where there's room to explain it; here it's one line
        // so the entries start as high up the page as possible.
        subtitle={
          transactions.length === 0 ? (
            "Nothing recorded this month."
          ) : (
            <>
              {transactions.length}{" "}
              {transactions.length === 1 ? "entry" : "entries"} ·{" "}
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
        <TransactionList
          uid={uid}
          transactions={transactions}
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
