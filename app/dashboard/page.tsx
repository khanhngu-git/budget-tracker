"use client";

import { useState } from "react";
import { AccountCards } from "@/components/dashboard/account-cards";
import { AdjustBalanceDialog } from "@/components/dashboard/adjust-balance-dialog";
import { AllocationChart } from "@/components/dashboard/allocation-chart";
import { BudgetPulse } from "@/components/dashboard/budget-pulse";
import { ExpenseChart } from "@/components/dashboard/expense-chart";
import { MonthVerdict } from "@/components/dashboard/month-verdict";
import { Section } from "@/components/dashboard/section";
import { allGoalProgress, monthElapsed, rollUpGoals } from "@/lib/budget/analytics";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel, formatMoney } from "@/lib/budget/format";
import type { AccountKind } from "@/lib/budget/types";

export default function OverviewPage() {
  const {
    uid,
    accounts,
    openingAccounts,
    transactions,
    goals,
    totalCents,
    openingTotalCents,
    loading,
    goalsLoading,
    monthStart,
  } = useBudgetContext();
  const [adjusting, setAdjusting] = useState<AccountKind | null>(null);

  const monthLabel = formatMonthLabel(monthStart);
  const rollup = rollUpGoals(
    allGoalProgress(goals, transactions, monthElapsed(monthStart)),
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
      >
        <AccountCards
          accounts={accounts}
          openingAccounts={openingAccounts}
          transactions={transactions}
          onAdjust={setAdjusting}
        />
        <AllocationChart accounts={accounts} />
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
          key={adjusting}
          uid={uid}
          account={adjusting}
          currentCents={accounts[adjusting].balanceCents}
          monthStart={monthStart}
          open
          onClose={() => setAdjusting(null)}
        />
      ) : null}
    </>
  );
}
