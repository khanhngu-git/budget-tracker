"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/nav/user-menu";
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
  const { formatKey, preferences, ready } = useSettings();
  const { user } = useAuth();
  const {
    uid,
    liveAccounts,
    monthStart,
    setMonthStart,
    needsOpeningBalances,
    loading,
    error,
  } = useBudgetContext();
  /**
   * Whether the setup flow is on screen — latched, not derived.
   *
   * It cannot be read straight off `needsOpeningBalances`, because the flow
   * *clears* that flag partway through: the accounts are written at the end of
   * the balances step, and the budget step comes after. Deriving would unmount
   * the dialog at precisely that moment and the third step would never appear.
   * So the flag only ever opens it; closing it is the dialog's own job.
   */
  const [showSetup, setShowSetup] = useState(false);

  // Rising edge, during render, so the dialog is already open on the frame the
  // condition becomes true — including the frame a reset lands on, which is
  // what makes fresh setup appear without a reload.
  // `ready` matters as much as `loading` here: the dialog decides once, on
  // mount, whether to ask for a name — and unready preferences report an empty
  // one, which would put the name step in front of someone who already has it.
  const needsSetup = needsOpeningBalances && !loading && ready;
  const [wasNeeded, setWasNeeded] = useState(needsSetup);
  if (wasNeeded !== needsSetup) {
    setWasNeeded(needsSetup);
    if (needsSetup) setShowSetup(true);
  }

  const pathname = usePathname();
  const isMonthly = !pathname.startsWith("/dashboard/settings");

  /* The travelling underline, measured off the tab that is actually current. */
  const tabsRef = useRef<HTMLUListElement>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const list = tabsRef.current;
    if (!list) return;

    const measure = () => {
      const active = list.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active) return;
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth });
    };

    measure();
    // Fonts landing late and the strip being scrolled both move the target.
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [pathname]);

  const background = preferences.backgroundImage;

  return (
    <div
      className={`relative flex flex-1 flex-col ${
        background ? "" : "bg-surface-muted"
      }`}
    >
      {/* Fixed and behind everything, with a scrim over it. A photo under a
          page of small tabular numbers is unreadable at full strength, and the
          scrim is what lets any photo work rather than only dark ones — it is
          drawn from the theme's own background, so it dims in light mode and
          in dark mode by the same rule the rest of the app follows. */}
      {background ? (
        <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={background} alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-background/80 backdrop-blur-[5px]" />
        </div>
      ) : null}

      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-2 px-4 sm:px-6">
          {/* Home, not Overview: this is the one escape hatch back out to
              the public site, and a signed-in user who wants it has no other
              way to reach it. The tab bar below already covers Overview. */}
          <Logo href="/" />
          <UserMenu />
        </div>

        {/* Five tabs don't fit a phone at any padding that leaves them
            tappable, and a wrapping row pushes the content down by a whole
            line. So the strip scrolls, with fades at the gutters standing in
            for the hidden scrollbar. */}
        <div className="relative mx-auto w-full max-w-5xl">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-4 bg-gradient-to-r from-surface to-transparent sm:hidden"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface to-transparent sm:hidden"
          />
          <nav
            aria-label="Dashboard sections"
            className="no-scrollbar -mb-px overflow-x-auto px-4 sm:px-6"
          >
            <ul ref={tabsRef} className="relative flex w-max gap-1">
              {/* One underline that travels, rather than a border appearing on
                  the new tab and vanishing from the old. The movement is what
                  connects the two — you can see which tab you came from. It is
                  measured rather than calculated, because the labels are
                  different widths and the strip scrolls on a phone. */}
              <span
                aria-hidden
                className="absolute bottom-0 h-0.5 rounded-full bg-foreground transition-[left,width] duration-300 ease-out motion-reduce:transition-none"
                style={{ left: indicator.left, width: indicator.width }}
              />
              {TABS.map((tab) => {
                // "/dashboard" would otherwise match every child route.
                const current =
                  tab.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(tab.href);

                return (
                  <li key={tab.href} className="shrink-0">
                    <Link
                      href={tab.href}
                      aria-current={current ? "page" : undefined}
                      data-tab={tab.href}
                      className={`inline-flex h-11 items-center whitespace-nowrap border-b-2 border-transparent px-2.5 text-sm font-medium transition-colors sm:h-10 sm:px-3 ${
                        current ? "text-foreground" : "text-muted hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
        {/* Settings is the one page that isn't about a month — nothing on it
            reads the ledger — so offering to change one there only invites the
            user to wonder what it did. */}
        {isMonthly ? (
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
        ) : (
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Settings
          </h1>
        )}

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
      {uid && showSetup ? (
        <OnboardingDialog
          uid={uid}
          existing={liveAccounts}
          // Either source counts: the profile document is what the app reads,
          // and the auth record is what Google fills in when it has one.
          knownName={preferences.displayName || user?.displayName || ""}
          open
          // Closing without finishing leaves the flag unset, so the prompt
          // returns next session — "later" means later, not never.
          onClose={() => setShowSetup(false)}
        />
      ) : null}
    </div>
  );
}
