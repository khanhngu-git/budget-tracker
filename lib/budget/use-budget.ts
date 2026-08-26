"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { backfillAccounts, subscribeAccounts } from "./accounts";
import { migrateLegacyGoals, subscribeGoals, type GoalMap } from "./goals";
import { subscribeProfile } from "./profile";
import { catchUpRecurring, subscribeRecurring } from "./recurring";
import { addMonths, endOfMonth, monthKey, startOfMonth } from "./format";
import { applyLedger, sumBalances, type Deltas } from "./ledger";
import { subscribeTransactionsFrom } from "./transactions";
import type { HistoryPeriod } from "./analytics";
import type { Account, RecurringRule, Transaction } from "./types";

export { addMonths, endOfMonth, startOfMonth };
export type { HistoryPeriod };

/**
 * How far back the growth chart looks — and therefore how much of the ledger
 * one session loads. A year is the span that makes a trend legible; going
 * further would cost reads for months nobody scrolls to.
 */
export const HISTORY_MONTHS = 12;

/** Buckets the growth chart plots, and how many of each it shows. */
export const HISTORY_POINTS: Record<HistoryPeriod, number> = {
  daily: 30,
  weekly: 12,
  monthly: 12,
  yearly: 5,
};

export const HISTORY_PERIOD_LABELS: Record<HistoryPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/**
 * The ledger window a period needs.
 *
 * A month, a week and a day all fit inside the year that's loaded anyway, so
 * switching between them costs nothing. Years are the one view that can't be
 * answered from a year of entries, so it — and only it — widens the window.
 */
export function historyMonthsFor(period: HistoryPeriod): number {
  return period === "yearly"
    ? HISTORY_POINTS.yearly * 12
    : HISTORY_MONTHS;
}

/** Stable empty values, so "not loaded yet" doesn't churn referential identity. */
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_GOALS: GoalMap = Object.freeze({});
const EMPTY_RECURRING: RecurringRule[] = [];

/** Applies a run of entries to the balance each account carries. */
function shiftAccounts(
  accounts: Account[],
  transactions: Transaction[],
  sign: 1 | -1,
): Account[] {
  const deltas = applyLedger({}, transactions, sign);
  return accounts.map((account) => ({
    ...account,
    balanceCents: account.balanceCents + (deltas[account.id] ?? 0),
  }));
}

function balancesOf(accounts: Account[]): Deltas {
  return Object.fromEntries(
    accounts.map((account) => [account.id, account.balanceCents]),
  );
}

/**
 * Live accounts, the selected month's transactions, and a year of history for
 * the signed-in user.
 *
 * Each slice of state carries the key it was loaded for, so "is this loaded?"
 * is derived by comparing keys during render rather than by flipping a loading
 * flag from inside an effect (which would cascade renders on every change).
 */
export function useBudget(monthStart: Date, historyPeriod: HistoryPeriod) {
  const { user } = useAuth();
  const historyMonths = historyMonthsFor(historyPeriod);
  const uid = user?.uid ?? null;
  const monthTime = monthStart.getTime();

  const [accountsState, setAccountsState] = useState<{
    key: string;
    value: Account[];
  }>({ key: "", value: EMPTY_ACCOUNTS });

  const [ledgerState, setLedgerState] = useState<{
    key: string;
    value: Transaction[];
  }>({ key: "", value: EMPTY_TRANSACTIONS });

  const [goalsState, setGoalsState] = useState<{
    key: string;
    value: GoalMap;
  }>({ key: "", value: EMPTY_GOALS });

  // Keyed like every other slice here, so "not loaded yet" is derived during
  // render instead of reset from inside the effect — the onboarding prompt
  // must never flash before the answer has actually arrived.
  const [profileState, setProfileState] = useState<{
    key: string;
    value: boolean;
  }>({ key: "", value: false });

  const [recurringState, setRecurringState] = useState<{
    key: string;
    value: RecurringRule[];
  }>({ key: "", value: EMPTY_RECURRING });

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    // Fire-and-forget: if this fails, the subscription below surfaces the
    // problem through the same error channel.
    backfillAccounts(uid).catch(() => {
      setError("Couldn't set up your accounts. Check your Firestore rules.");
    });

    return subscribeAccounts(
      uid,
      (next) => {
        setAccountsState({ key: uid, value: next });
        setError(null);
      },
      () => setError("Couldn't load your accounts. Check your Firestore rules."),
    );
  }, [uid]);

  // One window over the ledger: a year of history, the month on screen, and
  // everything after it. Three overlapping subscriptions would read most of
  // this twice and could disagree with each other mid-update.
  useEffect(() => {
    if (!uid) return;
    const key = `${uid}:${monthTime}:${historyMonths}`;
    const from = addMonths(new Date(monthTime), -(historyMonths - 1));

    return subscribeTransactionsFrom(
      uid,
      from,
      (next) => setLedgerState({ key, value: next }),
      () => setError("Couldn't load transactions. Check your Firestore rules."),
    );
  }, [uid, monthTime, historyMonths]);

  useEffect(() => {
    if (!uid) return;
    const key = `${uid}:${monthTime}`;

    return subscribeGoals(
      uid,
      monthKey(new Date(monthTime)),
      (next) => setGoalsState({ key, value: next }),
      () => setError("Couldn't load your budget. Check your Firestore rules."),
    );
  }, [uid, monthTime]);

  useEffect(() => {
    if (!uid) return;
    const key = uid;

    return subscribeRecurring(
      uid,
      (next) => setRecurringState({ key, value: next }),
      () => setError("Couldn't load your recurring entries."),
    );
  }, [uid]);

  // Posts whatever the user's schedules owe, once per session. It's dated by
  // the day each occurrence was due, so opening the app late doesn't bunch a
  // month of rent onto today — and it's safe to run twice, because each rule
  // advances its own marker inside the same transaction that writes its
  // entries.
  useEffect(() => {
    if (!uid) return;
    catchUpRecurring(uid).catch(() => {
      setError("Couldn't post your recurring entries. They'll retry later.");
    });
  }, [uid]);

  useEffect(() => {
    if (!uid) return;

    return subscribeProfile(
      uid,
      (profile) =>
        setProfileState({ key: uid, value: profile.openingBalancesSet }),
      // A profile that won't load shouldn't block the app; treat it as done
      // rather than trapping the user behind a prompt they can't dismiss.
      () => setProfileState({ key: uid, value: true }),
    );
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    // One-off: rehome goals from the build where a single plan covered every
    // month. Lands them in the real current month, not whichever month happens
    // to be on screen, so the result doesn't depend on where the user was.
    migrateLegacyGoals(uid, monthKey(new Date())).catch(() => {
      // Nothing to tell the user: their month's plan still loads either way,
      // and the subscription above reports a genuine permissions problem.
    });
  }, [uid]);

  const accountsReady = uid !== null && accountsState.key === uid;
  const ledgerReady =
    uid !== null && ledgerState.key === `${uid}:${monthTime}:${historyMonths}`;
  const goalsReady = uid !== null && goalsState.key === `${uid}:${monthTime}`;
  const profileReady = uid !== null && profileState.key === uid;

  const recurringReady = uid !== null && recurringState.key === uid;
  const recurring = recurringReady ? recurringState.value : EMPTY_RECURRING;

  const liveAccounts = accountsReady ? accountsState.value : EMPTY_ACCOUNTS;
  const ledger = ledgerReady ? ledgerState.value : EMPTY_TRANSACTIONS;
  const goals = goalsReady ? goalsState.value : EMPTY_GOALS;

  const monthEndTime = useMemo(
    () => endOfMonth(new Date(monthTime)).getTime(),
    [monthTime],
  );

  const transactions = useMemo(
    () =>
      ledger.filter(
        (entry) =>
          entry.date.getTime() >= monthTime &&
          entry.date.getTime() < monthEndTime,
      ),
    [ledger, monthTime, monthEndTime],
  );

  const laterTransactions = useMemo(
    () => ledger.filter((entry) => entry.date.getTime() >= monthEndTime),
    [ledger, monthEndTime],
  );

  // What the accounts were worth when the viewed month closed: the running
  // total with everything recorded after that month taken back off. Rewinding
  // from today rather than replaying from the beginning of time means the
  // months people actually look at — the recent ones — cost the fewest reads.
  const accounts = useMemo(
    () => shiftAccounts(liveAccounts, laterTransactions, -1),
    [liveAccounts, laterTransactions],
  );

  // What rolled in from the month before, before anything in this month.
  const openingAccounts = useMemo(
    () => shiftAccounts(accounts, transactions, -1),
    [accounts, transactions],
  );

  const accountsById = useMemo(
    () => Object.fromEntries(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const closingBalances = useMemo(() => balancesOf(accounts), [accounts]);

  const totalCents = useMemo(
    () => sumBalances(closingBalances),
    [closingBalances],
  );

  const openingTotalCents = useMemo(
    () => sumBalances(balancesOf(openingAccounts)),
    [openingAccounts],
  );

  return {
    uid,
    /** Accounts in display order, holding what they closed the viewed month at. */
    accounts,
    /** The same accounts, holding what rolled in from the month before. */
    openingAccounts,
    /** The running, all-time balances a new entry will actually settle against. */
    liveAccounts,
    accountsById,
    closingBalances,
    /** Entries dated inside the viewed month. */
    transactions,
    /** The whole loaded window — at least a year back, for the growth chart. */
    ledger,
    goals,
    /** Standing instructions, whether or not they're currently running. */
    recurring,
    recurringLoading: !recurringReady,
    totalCents,
    openingTotalCents,
    /** True once we know the user has never answered the balance prompt. */
    needsOpeningBalances: profileReady && !profileState.value,
    loading: !accountsReady || !ledgerReady,
    goalsLoading: !goalsReady,
    error,
  };
}
