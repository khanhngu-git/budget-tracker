"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { OpeningBalancesDialog } from "@/components/dashboard/opening-balances-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel } from "@/lib/budget/format";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/budget", label: "Budget" },
] as const;

/**
 * Chrome shared by every dashboard page: identity, the tab bar, and the month
 * control.
 *
 * The month switcher sits here rather than on each page because it filters all
 * three of them — the same choice has to survive navigating between Overview,
 * Transactions and Budgets, or "August" would quietly become "this month" on
 * every click.
 */
export function DashboardShell({ children }: { children: ReactNode }) {
  const { user, logOut } = useAuth();
  const { uid, monthStart, setMonthStart, needsOpeningBalances, error } =
    useBudgetContext();
  // Dismissing leaves the flag unset, so the prompt returns next session
  // rather than being lost to a stray Escape.
  const [dismissed, setDismissed] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {user?.email}
            </span>
            <Button variant="outline" size="sm" onClick={logOut}>
              Log out
            </Button>
          </div>
        </div>

        <nav
          aria-label="Dashboard sections"
          className="mx-auto w-full max-w-5xl px-6"
        >
          <ul className="-mb-px flex gap-1">
            {TABS.map((tab) => {
              // "/dashboard" would otherwise match every child route.
              const current =
                tab.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(tab.href);

              return (
                <li key={tab.href}>
                  <Link
                    href={tab.href}
                    aria-current={current ? "page" : undefined}
                    className={`inline-flex h-10 items-center border-b-2 px-3 text-sm font-medium transition-colors ${
                      current
                        ? "border-foreground text-foreground"
                        : "border-transparent text-muted hover:text-foreground"
                    }`}
                  >
                    {tab.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {formatMonthLabel(monthStart)}
          </h1>
          <MonthSwitcher
            monthStart={monthStart}
            onChange={setMonthStart}
            showLabel={false}
          />
        </div>

        {error ? (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        {children}
      </main>

      {uid && needsOpeningBalances && !dismissed ? (
        <OpeningBalancesDialog
          uid={uid}
          open
          onClose={() => setDismissed(true)}
        />
      ) : null}
    </div>
  );
}
