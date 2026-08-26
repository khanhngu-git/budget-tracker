"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ensureAccounts, subscribeAccounts } from "./accounts";
import { migrateLegacyGoals, subscribeGoals, type GoalMap } from "./goals";
import { subscribeProfile } from "./profile";
import { addMonths, endOfMonth, monthKey, startOfMonth } from "./format";
import { applyLedger, sumBalances, type Deltas } from "./ledger";
import { subscribeTransactionsFrom } from "./transactions";
import type { Account, Transaction } from "./types";

export { addMonths, endOfMonth, startOfMonth };

/**
 * How far back the growth chart looks — and therefore how much of the ledger
 * one session loads. A year is the span that makes a trend legible; going
 * further would cost reads for months nobody scrolls to.
 */
export const HISTORY_MONTHS = 12;

/** Stable empty values, so "not loaded yet" doesn't churn referential identity. */
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_GOALS: GoalMap = Object.freeze({});

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
export function useBudget(monthStart: Date) {
  const { user } = useAuth();
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

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    // Fire-and-forget: if this fails, the subscription below surfaces the
    // problem through the same error channel.
    ensureAccounts(uid).catch(() => {
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
    const key = `${uid}:${monthTime}`;
    const from = addMonths(new Date(monthTime), -(HISTORY_MONTHS - 1));

    return subscribeTransactionsFrom(
      uid,
      from,
      (next) => setLedgerState({ key, value: next }),
      () => setError("Couldn't load transactions. Check your Firestore rules."),
    );
  }, [uid, monthTime]);

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
  const ledgerReady = uid !== null && ledgerState.key === `${uid}:${monthTime}`;
  const goalsReady = uid !== null && goalsState.key === `${uid}:${monthTime}`;
  const profileReady = uid !== null && profileState.key === uid;

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
    /** The whole loaded window — a year back, for the growth chart. */
    ledger,
    goals,
    totalCents,
    openingTotalCents,
    /** True once we know the user has never answered the balance prompt. */
    needsOpeningBalances: profileReady && !profileState.value,
    loading: !accountsReady || !ledgerReady,
    goalsLoading: !goalsReady,
    error,
  };
}
