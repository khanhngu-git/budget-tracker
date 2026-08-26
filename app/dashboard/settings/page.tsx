"use client";

import { useState } from "react";
import { AccountsDialog } from "@/components/dashboard/accounts-dialog";
import { Section } from "@/components/dashboard/section";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { formatMoney } from "@/lib/budget/format";
import { useBudgetContext } from "@/lib/budget/budget-context";
import {
  ACCOUNT_TYPE_ICONS,
  ACCOUNT_TYPE_LABELS,
  isDebt,
} from "@/lib/budget/types";
import { useSettings } from "@/lib/settings/settings-context";

/**
 * Everything that isn't a number.
 *
 * The bands are in the order someone actually looks for them: who you are,
 * how the app looks, how you get in, what it's counting, and — last, behind
 * its own border — the two things that throw it all away.
 */
export default function SettingsPage() {
  const { ready } = useSettings();
  const { uid, liveAccounts, loading } = useBudgetContext();
  const [managing, setManaging] = useState(false);

  const owed = liveAccounts
    .filter((account) => isDebt(account.type))
    .reduce((sum, account) => sum + Math.abs(account.balanceCents), 0);

  return (
    <>
      <Section
        title="You"
        subtitle="Your name, your picture, and how you'd like to be referred to."
      >
        {ready ? (
          <ProfileSettings />
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
            Loading your profile…
          </p>
        )}
      </Section>

      <Section
        divided
        title="Look and feel"
        subtitle="How the app is drawn, and how money is written."
      >
        {ready ? (
          <AppearanceSettings />
        ) : (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
            Loading your settings…
          </p>
        )}
      </Section>

      <Section
        divided
        title="Signing in"
        subtitle="How you get into this account, and how to change your password."
      >
        <SecuritySettings />
      </Section>

      <Section
        divided
        title="Your accounts"
        subtitle={
          loading
            ? "Loading your accounts…"
            : liveAccounts.length === 0
              ? "You haven't added any accounts yet."
              : `${liveAccounts.length} account${
                  liveAccounts.length === 1 ? "" : "s"
                }${owed > 0 ? ` · ${formatMoney(owed)} owed` : ""}.`
        }
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
        {liveAccounts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
            Add an account for every place you keep money — and one for
            everywhere you owe it.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3">
            {liveAccounts.map((account) => (
              <li
                key={account.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2"
              >
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
                >
                  <Icon
                    name={ACCOUNT_TYPE_ICONS[account.type]}
                    className="h-4 w-4"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {account.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {ACCOUNT_TYPE_LABELS[account.type]}
                  </span>
                </span>
                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    account.balanceCents < 0
                      ? "text-negative"
                      : "text-foreground"
                  }`}
                >
                  {isDebt(account.type)
                    ? `${formatMoney(Math.abs(account.balanceCents))} owed`
                    : formatMoney(account.balanceCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section
        divided
        title="Danger zone"
        subtitle="Two things you can't take back."
      >
        <DangerZone />
      </Section>

      {uid && managing ? (
        <AccountsDialog
          uid={uid}
          accounts={liveAccounts}
          open
          onClose={() => setManaging(false)}
        />
      ) : null}
    </>
  );
}
