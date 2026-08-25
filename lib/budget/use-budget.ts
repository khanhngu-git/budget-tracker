"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { ensureAccounts, subscribeAccounts } from "./accounts";
import { migrateLegacyGoals, subscribeGoals, type GoalMap } from "./goals";
import { subscribeProfile } from "./profile";
import { monthKey } from "./format";
import {
  subscribeMonthTransactions,
  subscribeTransactionsFrom,
  transactionDeltas,
} from "./transactions";
import {
  ACCOUNT_KINDS,
  type Account,
  type AccountKind,
  type Transaction,
} from "./types";

/** Stable empty values, so "not loaded yet" doesn't churn referential identity. */
const EMPTY_ACCOUNTS = Object.freeze(
  Object.fromEntries(
    ACCOUNT_KINDS.map((kind) => [kind, { kind, balanceCents: 0 }]),
  ),
) as Record<AccountKind, Account>;

const EMPTY_TRANSACTIONS: Transaction[] = [];
const EMPTY_GOALS: GoalMap = Object.freeze({});

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function endOfMonth(monthStart: Date): Date {
  return addMonths(monthStart, 1);
}

/** Applies a set of deltas to a balance sheet, in the given direction. */
function shift(
  balances: Record<AccountKind, Account>,
  transactions: Transaction[],
  sign: 1 | -1,
): Record<AccountKind, Account> {
  const next = Object.fromEntries(
    ACCOUNT_KINDS.map((kind) => [
      kind,
      { kind, balanceCents: balances[kind].balanceCents },
    ]),
  ) as Record<AccountKind, Account>;

  for (const transaction of transactions) {
    const deltas = transactionDeltas(transaction);
    for (const kind of ACCOUNT_KINDS) {
      next[kind].balanceCents += sign * (deltas[kind] ?? 0);
    }
  }

  return next;
}

/**
 * Live accounts + the selected month's transactions for the signed-in user.
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
    value: Record<AccountKind, Account>;
  }>({ key: "", value: EMPTY_ACCOUNTS });

  const [transactionsState, setTransactionsState] = useState<{
    key: string;
    value: Transaction[];
  }>({ key: "", value: EMPTY_TRANSACTIONS });

  const [laterState, setLaterState] = useState<{
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

  useEffect(() => {
    if (!uid) return;
    const key = `${uid}:${monthTime}`;

    return subscribeMonthTransactions(
      uid,
      new Date(monthTime),
      (next) => setTransactionsState({ key, value: next }),
      () => setError("Couldn't load transactions. Check your Firestore rules."),
    );
  }, [uid, monthTime]);

  useEffect(() => {
    if (!uid) return;
    const key = `${uid}:${monthTime}`;

    return subscribeTransactionsFrom(
      uid,
      endOfMonth(new Date(monthTime)),
      (next) => setLaterState({ key, value: next }),
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
  const transactionsReady =
    uid !== null && transactionsState.key === `${uid}:${monthTime}`;

  const laterReady = uid !== null && laterState.key === `${uid}:${monthTime}`;
  const goalsReady = uid !== null && goalsState.key === `${uid}:${monthTime}`;
  const profileReady = uid !== null && profileState.key === uid;

  const liveAccounts = accountsReady ? accountsState.value : EMPTY_ACCOUNTS;
  const laterTransactions = laterReady ? laterState.value : EMPTY_TRANSACTIONS;
  const goals = goalsReady ? goalsState.value : EMPTY_GOALS;
  const transactions = transactionsReady
    ? transactionsState.value
    : EMPTY_TRANSACTIONS;

  // What the accounts were worth when the viewed month closed: the running
  // total with everything recorded after that month taken back off. Rewinding
  // from today rather than replaying from the beginning of time means the
  // months people actually look at — the recent ones — cost the fewest reads.
  const accounts = useMemo(
    () => shift(liveAccounts, laterTransactions, -1),
    [liveAccounts, laterTransactions],
  );

  // What rolled in from the month before, before anything in this month.
  const openingAccounts = useMemo(
    () => shift(accounts, transactions, -1),
    [accounts, transactions],
  );

  const totalCents = useMemo(
    () =>
      ACCOUNT_KINDS.reduce((sum, kind) => sum + accounts[kind].balanceCents, 0),
    [accounts],
  );

  const openingTotalCents = useMemo(
    () =>
      ACCOUNT_KINDS.reduce(
        (sum, kind) => sum + openingAccounts[kind].balanceCents,
        0,
      ),
    [openingAccounts],
  );

  return {
    uid,
    /** Closing balances for the month being viewed. */
    accounts,
    /** Balances carried in from the month before. */
    openingAccounts,
    /** The running, all-time balances a new entry will actually settle against. */
    liveAccounts,
    transactions,
    goals,
    totalCents,
    openingTotalCents,
    /** True once we know the user has never answered the balance prompt. */
    needsOpeningBalances: profileReady && !profileState.value,
    loading: !accountsReady || !transactionsReady || !laterReady,
    goalsLoading: !goalsReady,
    error,
  };
}
