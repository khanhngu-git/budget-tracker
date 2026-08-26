import type { Transaction, TransactionKind } from "./types";

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
