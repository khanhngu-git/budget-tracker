"use client";

import { useState } from "react";
import Link from "next/link";
import { AccountCards } from "@/components/dashboard/account-cards";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { AccountsDialog } from "@/components/dashboard/accounts-dialog";
import { AdjustBalanceDialog } from "@/components/dashboard/adjust-balance-dialog";
import { TransactionDialog } from "@/components/dashboard/transaction-dialog";
import { BudgetPulse } from "@/components/dashboard/budget-pulse";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { allGoalProgress, monthElapsed, rollUpGoals } from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel, formatMoney } from "@/lib/budget/format";
import type { Account } from "@/lib/budget/types";

/**
 * Two questions, in order: how much have I got, and am I on track?
 *
 * The split sits with the balances because it's the same answer said a second
 * way — how much, and how much of it is where. Everything that explains *why*
 * the answer moved — the trend, the category breakdown — lives on Statistics.
 * A dashboard that shows all of it at once makes the reader hunt for the
 * balance they opened the app to check.
 */
export default function OverviewPage() {
  const {
    uid,
    accounts,
    openingAccounts,
    liveAccounts,
    transactions,
    settledTransactions,
    goals,
    totalCents,
    openingTotalCents,
    goalsLoading,
    monthStart,
    setMonthStart,
  } = useBudgetContext();
  const [adjusting, setAdjusting] = useState<Account | null>(null);
  const [managing, setManaging] = useState(false);
  // Quick-add from a card: the same dialog the Transactions page uses, opened
  // with the account already chosen so the common case is one field of typing.
  const [addingTo, setAddingTo] = useState<Account | null>(null);

  const monthLabel = formatMonthLabel(monthStart);
  const rollup = rollUpGoals(
    allGoalProgress(goals, settledTransactions, monthElapsed(monthStart), accounts),
  );

  return (
    <>
      <Section
        title="Your accounts"
        subtitle={`${formatMoney(totalCents)} at the end of ${monthLabel}, carried in from ${formatMoney(
          openingTotalCents,
        )}.`}
        action={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManaging(true)}
            disabled={!uid}
          >
            <Icon name="pencil" className="h-4 w-4" />
            Edit
          </Button>
        }
      >
        <AccountCards
          uid={uid}
          accounts={accounts}
          openingAccounts={openingAccounts}
          transactions={transactions}
          onAdjust={setAdjusting}
          onQuickAdd={setAddingTo}
        />

        {/* Directly under the cards, because it answers the question the cards
            raise: a column of balances says how much, not how it's split. */}
        <AllocationChart accounts={accounts} />
      </Section>

      <Section
        divided
        title={`Are you on track for ${monthLabel}?`}
      >
        <BudgetPulse rollup={rollup} loading={goalsLoading} />

        <p className="text-sm text-muted">
          Want the detail?{" "}
          <Link
            href="/dashboard/statistics"
            className="font-medium text-foreground underline underline-offset-4"
          >
            See your statistics
          </Link>{" "}
          for the trend and where the money went.
        </p>
      </Section>

      {uid && addingTo ? (
        <TransactionDialog
          key={`quick-${addingTo.id}`}
          uid={uid}
          accounts={liveAccounts}
          transaction={null}
          presetAccountId={addingTo.id}
          monthStart={monthStart}
          onMonthChange={setMonthStart}
          open
          onClose={() => setAddingTo(null)}
        />
      ) : null}

      {uid && adjusting ? (
        <AdjustBalanceDialog
          key={adjusting.id}
          uid={uid}
          account={adjusting}
          currentCents={adjusting.balanceCents}
          monthStart={monthStart}
          open
          onClose={() => setAdjusting(null)}
        />
      ) : null}

      {uid && managing ? (
        <AccountsDialog
          uid={uid}
          // Judged against the running total, not the month on screen: an
          // account you emptied last week is empty now, whatever July says.
          accounts={liveAccounts}
          open
          onClose={() => setManaging(false)}
        />
      ) : null}
    </>
  );
}
