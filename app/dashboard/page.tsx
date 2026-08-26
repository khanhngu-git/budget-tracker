"use client";

import { useState } from "react";
import { AccountCards } from "@/components/dashboard/account-cards";
import { AccountsDialog } from "@/components/dashboard/accounts-dialog";
import { AdjustBalanceDialog } from "@/components/dashboard/adjust-balance-dialog";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { BudgetPulse } from "@/components/dashboard/budget-pulse";
import { ExpenseChart } from "@/components/dashboard/expense-chart";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { MonthVerdict } from "@/components/dashboard/month-verdict";
import { Section } from "@/components/dashboard/section";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { allGoalProgress, monthElapsed, rollUpGoals } from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel, formatMoney } from "@/lib/budget/format";
import { HISTORY_MONTHS } from "@/lib/budget/use-budget";
import type { Account } from "@/lib/budget/types";

export default function OverviewPage() {
  const {
    uid,
    accounts,
    openingAccounts,
    liveAccounts,
    closingBalances,
    transactions,
    ledger,
    goals,
    totalCents,
    openingTotalCents,
    loading,
    goalsLoading,
    monthStart,
  } = useBudgetContext();
  const [adjusting, setAdjusting] = useState<Account | null>(null);
  const [managing, setManaging] = useState(false);

  const monthLabel = formatMonthLabel(monthStart);
  const rollup = rollUpGoals(
    allGoalProgress(goals, transactions, monthElapsed(monthStart), accounts),
  );

  return (
    <>
      {/* Accounts come first: "how much have I got?" is the question people
          open the app with, and everything below is commentary on it. */}
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
            <Icon name="plus" className="h-4 w-4" />
            Add or rename
          </Button>
        }
      >
        <AccountCards
          accounts={accounts}
          openingAccounts={openingAccounts}
          transactions={transactions}
          onAdjust={setAdjusting}
        />
        <AllocationChart accounts={accounts} />
        {/* The pie says where the money sits today; this says whether the pile
            is growing. Neither answers the other's question. */}
        <GrowthChart
          accounts={accounts}
          closingBalances={closingBalances}
          ledger={ledger}
          monthStart={monthStart}
          months={HISTORY_MONTHS}
          loading={loading}
        />
      </Section>

      <Section
        divided
        title={`How ${monthLabel} is going`}
        subtitle="The month you're viewing, in words first."
      >
        <MonthVerdict transactions={transactions} monthLabel={monthLabel} />
        <BudgetPulse rollup={rollup} loading={goalsLoading} />
        <ExpenseChart transactions={transactions} loading={loading} />
      </Section>

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
