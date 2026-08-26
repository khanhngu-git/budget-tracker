"use client";

import { ExpenseChart } from "@/components/dashboard/expense-chart";
import { GrowthChart } from "@/components/dashboard/growth-chart";
import { MonthVerdict } from "@/components/dashboard/month-verdict";
import { Section } from "@/components/dashboard/section";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel } from "@/lib/budget/format";

/**
 * The workings behind the Overview.
 *
 * Overview answers "how much have I got, and am I on track?" — two questions,
 * two glances. Everything that explains *why* the answer is what it is lives
 * here instead, where it can take the room it needs without pushing the
 * balances off the top of the screen.
 */
export default function StatisticsPage() {
  const {
    accounts,
    closingBalances,
    transactions,
    ledger,
    loading,
    monthStart,
    historyPeriod,
    setHistoryPeriod,
  } = useBudgetContext();

  const monthLabel = formatMonthLabel(monthStart);

  return (
    <>
      <Section
        title="Over time"
        subtitle="How the balances have moved, over whichever span you pick."
      >
        <GrowthChart
          accounts={accounts}
          closingBalances={closingBalances}
          ledger={ledger}
          monthStart={monthStart}
          period={historyPeriod}
          onPeriodChange={setHistoryPeriod}
          loading={loading}
        />
      </Section>

      <Section
        divided
        title={`Inside ${monthLabel}`}
        subtitle="What came in, what went out, and what it went on."
      >
        <MonthVerdict transactions={transactions} monthLabel={monthLabel} />
        <ExpenseChart transactions={transactions} loading={loading} />
      </Section>
    </>
  );
}
