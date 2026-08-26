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
    accountsById,
    transactions,
    loading,
    monthStart,
  } = useBudgetContext();
  // null means the dialog is closed; { transaction: null } means "adding".
  const [dialog, setDialog] = useState<{
    transaction: Transaction | null;
  } | null>(null);

  const { incomeCents, expenseCents, netCents } = summariseMonth(transactions);
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
            </>
          )
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
        <TransactionList
          uid={uid}
          transactions={transactions}
          accounts={accountsById}
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
