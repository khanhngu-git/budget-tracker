import { RequireAuth } from "@/components/auth/route-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BudgetProvider } from "@/lib/budget/budget-context";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      <BudgetProvider>
        <DashboardShell>{children}</DashboardShell>
      </BudgetProvider>
    </RequireAuth>
  );
}
