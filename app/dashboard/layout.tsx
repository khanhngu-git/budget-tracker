import { RequireAuth } from "@/components/auth/route-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BudgetProvider } from "@/lib/budget/budget-context";

/**
 * Settings are no longer provided here — they sit at the root layout, above
 * the public pages too, so the header renders the same user everywhere. They
 * still resolve before any figure below is formatted, which is what mattered.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      <BudgetProvider>
        <DashboardShell>{children}</DashboardShell>
      </BudgetProvider>
    </RequireAuth>
  );
}
