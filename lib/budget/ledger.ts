import { addDays, startOfDay } from "./format";
import type { Account, Transaction, TransactionKind } from "./types";

/**
 * The first instant that hasn't happened yet.
 *
 * Entries are dated at local midnight, so one dated today has arrived and one
 * dated tomorrow has not. Every "has this happened?" question in the app is
 * answered against this one number, which is also what makes the answers agree
 * with each other: the same cutoff greys out a row, keeps a bill out of the
 * month's net, and keeps it out of the balance it will eventually come off.
 *
 * It is the same value all day, so it can be recomputed freely without
 * churning a dependency list, and it moves on its own at midnight.
 */
export function notYetTime(now: Date = new Date()): number {
  return startOfDay(addDays(now, 1)).getTime();
}

/** Recorded, but not yet money that moved. */
export function isUpcoming(transaction: Transaction, cutoffTime: number): boolean {
  return transaction.date.getTime() >= cutoffTime;
}

/**
 * What one entry does to the balance sheet, with no Firestore in sight.
 *
 * Every mutation and every derived balance in the app is expressed through
 * this one function: adding applies the deltas, deleting applies their
 * negation, editing applies the difference, and the month views replay them to
 * rewind a balance. That's what keeps a five-way edit — change the amount, the
 * category and the account at once — from needing its own hand-written
 * arithmetic that could drift from the delete path.
 */

/** Cents moved, per account id. Accounts an entry doesn't touch are absent. */
export type Deltas = Record<string, number>;

/**
 * Everything a ledger entry needs to say, in the shape the caller supplies it.
 * Amounts are always positive; `kind` carries the direction.
 */
export type EntryInput =
  | {
      kind: "income" | "expense";
      accountId: string;
      amountCents: number;
      categoryId: string;
      note: string;
      date: Date;
    }
  | {
      kind: "transfer";
      accountId: string;
      toAccountId: string;
      amountCents: number;
      note: string;
      date: Date;
    }
  | {
      kind: "gain" | "loss";
      accountId: string;
      amountCents: number;
      note: string;
      date: Date;
    };

export function deltasFor(
  kind: TransactionKind,
  accountId: string,
  toAccountId: string | null,
  amountCents: number,
): Deltas {
  switch (kind) {
    case "income":
    case "gain":
      return { [accountId]: amountCents };
    case "expense":
    case "loss":
      return { [accountId]: -amountCents };
    case "transfer":
      if (!toAccountId) return {};
      return accountId === toAccountId
        ? {}
        : { [accountId]: -amountCents, [toAccountId]: amountCents };
  }
}

export function deltasForInput(input: EntryInput): Deltas {
  return deltasFor(
    input.kind,
    input.accountId,
    input.kind === "transfer" ? input.toAccountId : null,
    input.amountCents,
  );
}

/** The same arithmetic, for an entry that has already been loaded. */
export function transactionDeltas(transaction: Transaction): Deltas {
  return deltasFor(
    transaction.kind,
    transaction.accountId,
    transaction.toAccountId,
    transaction.amountCents,
  );
}

/**
 * Applies a run of entries to a set of balances, in the given direction.
 * `-1` rewinds — which is how a past month's closing balance is derived from
 * today's running total.
 */
export function applyLedger(
  balances: Readonly<Deltas>,
  transactions: Transaction[],
  sign: 1 | -1,
): Deltas {
  const next: Deltas = { ...balances };

  for (const transaction of transactions) {
    for (const [accountId, cents] of Object.entries(
      transactionDeltas(transaction),
    )) {
      next[accountId] = (next[accountId] ?? 0) + sign * cents;
    }
  }

  return next;
}

export function sumBalances(balances: Readonly<Deltas>): number {
  return Object.values(balances).reduce((sum, cents) => sum + cents, 0);
}

/** Applies a run of entries to the balance each account carries. */
export function shiftAccounts(
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

/**
 * What the accounts held at a given instant: the stored figure with every
 * entry dated at or after `cutoffTime` taken back off.
 *
 * One function at three cutoffs answers every balance in the app, which is
 * what keeps them agreeing with each other. It is also what keeps a
 * future-dated entry out of the money you actually have: a bill dated next
 * Tuesday is written down but deducted from nothing, and on Tuesday it starts
 * counting on its own — the cutoff moves, so there is no job to run and no way
 * for the deduction to be missed or applied twice.
 *
 * Rewinding from the stored total rather than replaying from the beginning of
 * time is what means the months people actually look at cost the fewest reads.
 */
export function balancesAt(
  stored: Account[],
  ledger: Transaction[],
  cutoffTime: number,
): Account[] {
  return shiftAccounts(
    stored,
    ledger.filter((entry) => entry.date.getTime() >= cutoffTime),
    -1,
  );
}
