import { RequireAuth } from "@/components/auth/route-guard";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { BudgetProvider } from "@/lib/budget/budget-context";
import { SettingsProvider } from "@/lib/settings/settings-context";

/**
 * Settings sit above the budget data because they change how it's read: the
 * currency every amount below here is formatted in is set by the provider, so
 * it has to be in place before anything renders a figure.
 */
export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <RequireAuth>
      <SettingsProvider>
        <BudgetProvider>
          <DashboardShell>{children}</DashboardShell>
        </BudgetProvider>
      </SettingsProvider>
    </RequireAuth>
  );
}
