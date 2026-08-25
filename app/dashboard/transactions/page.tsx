"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Section } from "@/components/dashboard/section";
import { TransactionDialog } from "@/components/dashboard/transaction-dialog";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { summariseMonth } from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import {
  formatMonthLabel,
  formatMoney,
  formatSignedMoney,
} from "@/lib/budget/format";
import type { Transaction } from "@/lib/budget/types";

export default function TransactionsPage() {
  const {
    uid,
    liveAccounts,
    transactions,
    totalCents,
    openingTotalCents,
    loading,
    monthStart,
  } = useBudgetContext();
  // null means the dialog is closed; { transaction: null } means "adding".
  const [dialog, setDialog] = useState<{
    transaction: Transaction | null;
  } | null>(null);

  const { incomeCents, expenseCents, netCents } = summariseMonth(transactions);
  const monthLabel = formatMonthLabel(monthStart);

  const figures = [
    { label: "Money in", value: formatMoney(incomeCents), tone: "text-foreground" },
    { label: "Money out", value: formatMoney(expenseCents), tone: "text-foreground" },
    {
      label: "Net for the month",
      value: formatSignedMoney(netCents),
      tone:
        netCents > 0
          ? "text-positive"
          : netCents < 0
            ? "text-negative"
            : "text-foreground",
    },
  ];

  return (
    <>
      <Section
        title={`Everything in ${monthLabel}`}
        subtitle={
          transactions.length === 0
            ? "Nothing recorded this month."
            : `${transactions.length} ${
                transactions.length === 1 ? "entry" : "entries"
              } · balance went from ${formatMoney(
                openingTotalCents,
              )} to ${formatMoney(totalCents)}.`
        }
        action={
          <Button
            onClick={() => setDialog({ transaction: null })}
            disabled={!uid}
          >
            <Icon name="plus" className="h-4 w-4" />
            Add entry
          </Button>
        }
      >
        {/* Net is the number this page is really asked for: did the month
            leave you ahead or behind? Income and expenses are the workings. */}
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-3">
          {figures.map((figure) => (
            <div key={figure.label} className="bg-surface px-5 py-4">
              <dt className="text-xs text-muted">{figure.label}</dt>
              <dd
                className={`mt-1 text-xl font-semibold tracking-tight ${figure.tone}`}
              >
                {figure.value}
              </dd>
            </div>
          ))}
        </dl>

        <TransactionList
          uid={uid}
          transactions={transactions}
          loading={loading}
          onEdit={(transaction) => setDialog({ transaction })}
        />
      </Section>

      {uid && dialog ? (
        <TransactionDialog
          // Remounts per entry so the form opens on that entry's own values.
          key={dialog.transaction?.id ?? "new"}
          uid={uid}
          accounts={liveAccounts}
          transaction={dialog.transaction}
          monthStart={monthStart}
          open
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
