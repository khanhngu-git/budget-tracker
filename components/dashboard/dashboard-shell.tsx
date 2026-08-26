"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/settings/avatar";
import { Button } from "@/components/ui/button";
import { MonthSwitcher } from "@/components/dashboard/month-switcher";
import { OnboardingDialog } from "@/components/dashboard/onboarding-dialog";
import { useAuth } from "@/lib/auth/auth-context";
import { useBudgetContext } from "@/lib/budget/budget-context";
import { formatMonthLabel } from "@/lib/budget/format";
import { useSettings } from "@/lib/settings/settings-context";

const TABS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/transactions", label: "Transactions" },
  { href: "/dashboard/budget", label: "Budget" },
  { href: "/dashboard/statistics", label: "Statistics" },
  { href: "/dashboard/settings", label: "Settings" },
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
  const { preferences, formatKey } = useSettings();
  const {
    uid,
    liveAccounts,
    monthStart,
    setMonthStart,
    needsOpeningBalances,
    loading,
    error,
  } = useBudgetContext();
  // Dismissing leaves the flag unset, so the prompt returns next session
  // rather than being lost to a stray Escape.
  const [dismissed, setDismissed] = useState(false);

  // …but a reset puts the app back to before onboarding, and a dismissal made
  // half an hour ago must not swallow the prompt for the empty books the user
  // has only just asked for. Re-armed on the false → true edge, during render,
  // so the dialog is already open on the frame the reset lands.
  const [wasNeeded, setWasNeeded] = useState(needsOpeningBalances);
  if (wasNeeded !== needsOpeningBalances) {
    setWasNeeded(needsOpeningBalances);
    if (needsOpeningBalances) setDismissed(false);
  }

  const pathname = usePathname();

  return (
    <div className="flex flex-1 flex-col bg-surface-muted">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
          <Logo href="/dashboard" />
          <div className="flex items-center gap-3">
            {/* Links to Settings rather than opening a menu: the avatar is the
                only thing on this page that is *about* the user, so the one
                page that is too. */}
            <Link
              href="/dashboard/settings"
              className="flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-surface-muted"
            >
              <Avatar
                preferences={preferences}
                fallback={user?.email ?? ""}
                size="sm"
              />
              <span className="hidden max-w-[14rem] truncate text-sm text-muted sm:inline">
                {preferences.displayName.trim() || user?.email}
              </span>
            </Link>
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

        {/* Keyed on the money format: pages below format amounts through a
            module-level setting rather than a prop, so a currency change has
            nothing to re-render them. Remounting the page — not the providers
            above it — is what makes the new currency appear everywhere at
            once, without tearing down the Firestore listeners. */}
        <div key={formatKey} className="flex flex-1 flex-col gap-6">
          {children}
        </div>
      </main>

      {/* Held until the accounts have arrived: the dialog decides which step to
          open on from whether any exist, and it only gets to decide once. */}
      {uid && needsOpeningBalances && !loading && !dismissed ? (
        <OnboardingDialog
          uid={uid}
          existing={liveAccounts}
          open
          onClose={() => setDismissed(true)}
        />
      ) : null}
    </div>
  );
}
