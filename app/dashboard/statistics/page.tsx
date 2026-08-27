"use client";

import { ExpensePie } from "@/components/dashboard/expense-pie";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { Section } from "@/components/dashboard/section";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel } from "@/lib/budget/format";

/**
 * The workings behind the Overview.
 *
 * Side by side rather than stacked. The two charts answer questions people ask
 * together — "how is it going?" and "what is it going on?" — and stacking them
 * put the second below the fold, which made comparing them a matter of memory.
 * Halving the trend to fit is a fair trade: its job is a shape, not a reading.
 */
export default function StatisticsPage() {
  const {
    accounts,
    closingBalances,
    balancesAsOf,
    settledTransactions,
    ledger,
    loading,
    monthStart,
    historyPeriod,
    setHistoryPeriod,
  } = useBudgetContext();

  return (
    <Section title={`${formatMonthLabel(monthStart)} in detail`}>
      <div className="grid gap-4 lg:grid-cols-2">
        <GrowthChart
          accounts={accounts}
          closingBalances={closingBalances}
          ledger={ledger}
          balancesAsOf={balancesAsOf}
          period={historyPeriod}
          onPeriodChange={setHistoryPeriod}
          loading={loading}
        />
        <ExpensePie transactions={settledTransactions} loading={loading} />
      </div>
    </Section>
  );
}
