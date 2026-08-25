import {
  Timestamp,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type QueryDocumentSnapshot,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { accountDoc } from "./accounts";
import {
  ACCOUNT_KINDS,
  ACCOUNT_LABELS,
  type AccountKind,
  type Transaction,
  type TransactionKind,
} from "./types";

export function transactionsPath(uid: string) {
  return collection(db, "users", uid, "transactions");
}

/** Thrown for rule violations we want to surface verbatim in the UI. */
export class BudgetError extends Error {}

function readBalance(data: unknown): number {
  const balance = (data as { balanceCents?: unknown } | undefined)?.balanceCents;
  return typeof balance === "number" ? balance : 0;
}

/** Narrows an arbitrary stored value to one of the three known accounts. */
function toAccountKind(value: unknown): AccountKind | null {
  return ACCOUNT_KINDS.includes(value as AccountKind)
    ? (value as AccountKind)
    : null;
}

/**
 * Everything a ledger entry needs to say, in the shape the caller supplies it.
 * Amounts are always positive; `kind` carries the direction.
 */
export type EntryInput =
  | {
      kind: "income" | "expense";
      amountCents: number;
      categoryId: string;
      note: string;
      date: Date;
    }
  | {
      kind: "transfer";
      accountId: AccountKind;
      toAccountId: AccountKind;
      amountCents: number;
      note: string;
      date: Date;
    }
  | {
      kind: "gain" | "loss";
      accountId: AccountKind;
      amountCents: number;
      note: string;
      date: Date;
    };

type Deltas = Partial<Record<AccountKind, number>>;

/** Public alias for the same shape, for callers outside this module. */
export type AccountDeltas = Deltas;

/**
 * How one entry moves each account, in cents.
 *
 * Every mutation in this file is expressed through this one function: adding
 * applies the deltas, deleting applies their negation, and editing applies the
 * difference between old and new. That's what keeps a five-way edit — change
 * the amount, the category and the account at once — from needing its own
 * hand-written balance arithmetic that could drift from the delete path.
 */
function deltasFor(
  kind: TransactionKind,
  accountId: AccountKind,
  toAccountId: AccountKind | null,
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

/**
 * The same arithmetic, for an entry that has already been loaded.
 *
 * The month views derive their balances by replaying these deltas, so read and
 * write agree on what an entry means by sharing one definition rather than two
 * that have to be kept in step.
 */
export function transactionDeltas(transaction: Transaction): AccountDeltas {
  return deltasFor(
    transaction.kind,
    transaction.accountId,
    transaction.toAccountId,
    transaction.amountCents,
  );
}

function deltasForInput(input: EntryInput): Deltas {
  switch (input.kind) {
    case "income":
    case "expense":
      return deltasFor(input.kind, "spending", null, input.amountCents);
    case "transfer":
      return deltasFor(
        input.kind,
        input.accountId,
        input.toAccountId,
        input.amountCents,
      );
    case "gain":
    case "loss":
      return deltasFor(input.kind, input.accountId, null, input.amountCents);
  }
}

/** The deltas an already-stored entry applied when it was written. */
function deltasForStored(data: Record<string, unknown>): Deltas {
  const accountId = toAccountKind(data.accountId);
  if (!accountId) throw new BudgetError("That entry can't be changed.");

  const kind = data.kind as TransactionKind;
  const amountCents =
    typeof data.amountCents === "number" ? data.amountCents : 0;

  if (kind === "transfer") {
    const toAccountId = toAccountKind(data.toAccountId);
    if (!toAccountId) throw new BudgetError("That entry can't be changed.");
    return deltasFor(kind, accountId, toAccountId, amountCents);
  }

  return deltasFor(kind, accountId, null, amountCents);
}

function documentFor(input: EntryInput) {
  const shared = {
    kind: input.kind,
    amountCents: input.amountCents,
    note: input.note,
    date: Timestamp.fromDate(input.date),
  };

  switch (input.kind) {
    case "income":
    case "expense":
      return {
        ...shared,
        accountId: "spending",
        toAccountId: null,
        categoryId: input.categoryId,
      };
    case "transfer":
      return {
        ...shared,
        accountId: input.accountId,
        toAccountId: input.toAccountId,
        categoryId: null,
      };
    case "gain":
    case "loss":
      return {
        ...shared,
        accountId: input.accountId,
        toAccountId: null,
        categoryId: null,
      };
  }
}

function validate(input: EntryInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new BudgetError("Enter an amount greater than zero.");
  }
  if (input.kind === "transfer" && input.accountId === input.toAccountId) {
    throw new BudgetError("Pick two different accounts.");
  }
}

/**
 * Reads every account an entry change touches, applies the net movement, and
 * leaves the caller to write the entry itself. All reads happen before any
 * write, as Firestore transactions require.
 */
async function settleBalances(
  tx: FirestoreTransaction,
  uid: string,
  before: Deltas,
  after: Deltas,
  next: EntryInput | null,
) {
  const net = new Map<AccountKind, number>();
  for (const kind of ACCOUNT_KINDS) {
    const change = (after[kind] ?? 0) - (before[kind] ?? 0);
    if (change !== 0) net.set(kind, change);
  }
  if (net.size === 0) return;

  const touched = [...net.keys()];
  const refs = touched.map((kind) => accountDoc(uid, kind));
  const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

  const resulting = new Map<AccountKind, number>();
  touched.forEach((kind, index) => {
    resulting.set(
      kind,
      readBalance(snapshots[index].data()) + (net.get(kind) ?? 0),
    );
  });

  // Unlike an expense, a transfer that exceeds the source balance is refused —
  // shuffling money you don't have between your own accounts is always an
  // error, not a record of something that happened.
  if (next?.kind === "transfer") {
    const source = resulting.get(next.accountId);
    if (source !== undefined && source < 0) {
      throw new BudgetError(
        `${ACCOUNT_LABELS[next.accountId]} doesn't have enough to transfer.`,
      );
    }
  }

  touched.forEach((kind, index) => {
    tx.set(
      refs[index],
      { kind, balanceCents: resulting.get(kind) ?? 0 },
      { merge: true },
    );
  });
}

/**
 * Records a ledger entry and moves the balances it affects in one atomic step,
 * so an entry can never land without its balance change (or vice versa).
 *
 * Expenses and losses are allowed to overdraw: the app records what actually
 * happened, and refusing the entry would just lose the data.
 */
export async function addTransaction(
  uid: string,
  input: EntryInput,
): Promise<void> {
  validate(input);
  const entryRef = doc(transactionsPath(uid));

  await runTransaction(db, async (tx) => {
    await settleBalances(tx, uid, {}, deltasForInput(input), input);
    tx.set(entryRef, { ...documentFor(input), createdAt: serverTimestamp() });
  });
}

/**
 * Rewrites an existing entry and re-settles the balances, so correcting a typo
 * fixes the history and the money in the same step.
 *
 * The entry's previous effect is re-read from the stored document rather than
 * taken from the caller, so a stale list on screen can never reverse the wrong
 * number.
 */
export async function updateTransaction(
  uid: string,
  transactionId: string,
  input: EntryInput,
): Promise<void> {
  validate(input);
  const entryRef = doc(transactionsPath(uid), transactionId);

  await runTransaction(db, async (tx) => {
    const entry = await tx.get(entryRef);
    if (!entry.exists()) {
      throw new BudgetError("That entry no longer exists.");
    }

    await settleBalances(
      tx,
      uid,
      deltasForStored(entry.data()),
      deltasForInput(input),
      input,
    );
    tx.update(entryRef, documentFor(input));
  });
}

/**
 * Removes an entry and undoes its effect on the balances it moved.
 *
 * A reversal is allowed to push an account negative — refusing to delete a
 * mistake because the money has since moved on would strand the error forever.
 */
export async function deleteTransaction(
  uid: string,
  transactionId: string,
): Promise<void> {
  const entryRef = doc(transactionsPath(uid), transactionId);

  await runTransaction(db, async (tx) => {
    const entry = await tx.get(entryRef);
    // Someone else already deleted it (or a second click landed): nothing to
    // undo, and reversing twice would corrupt the balance.
    if (!entry.exists()) return;

    await settleBalances(tx, uid, deltasForStored(entry.data()), {}, null);
    tx.delete(entryRef);
  });
}

/**
 * Restates an account's balance and records the difference as a gain or a
 * loss, so interest and market movement land in the history like everything
 * else instead of silently rewriting a number.
 */
export async function adjustAccountBalance(
  uid: string,
  accountId: AccountKind,
  input: { differenceCents: number; note: string; date: Date },
): Promise<void> {
  if (input.differenceCents === 0) {
    throw new BudgetError("That's already the balance — nothing to record.");
  }

  const entry: EntryInput = {
    kind: input.differenceCents > 0 ? "gain" : "loss",
    accountId,
    amountCents: Math.abs(input.differenceCents),
    note: input.note,
    date: input.date,
  };

  // Routed through the ordinary add path so the adjustment settles like any
  // other entry: a signed difference applied to whatever the balance is when
  // the write lands, rather than an absolute figure that would quietly discard
  // anything recorded since the dialog was opened.
  await addTransaction(uid, entry);
}

/**
 * Sets every account to the balance the user says it holds, recording each
 * difference as a gain or a loss.
 *
 * All three move in one transaction: a half-applied opening balance would
 * leave the books wrong with no obvious way for the user to tell which
 * accounts had taken and which hadn't.
 */
export async function setAccountBalances(
  uid: string,
  targets: Record<AccountKind, number>,
  input: { note: string; date: Date },
): Promise<void> {
  for (const kind of ACCOUNT_KINDS) {
    if (!Number.isInteger(targets[kind])) {
      throw new BudgetError("Enter each balance as an amount, like 1250.00.");
    }
  }

  await runTransaction(db, async (tx) => {
    const refs = ACCOUNT_KINDS.map((kind) => accountDoc(uid, kind));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

    ACCOUNT_KINDS.forEach((kind, index) => {
      const difference = targets[kind] - readBalance(snapshots[index].data());
      if (difference === 0) return;

      tx.set(
        refs[index],
        { kind, balanceCents: targets[kind] },
        { merge: true },
      );
      tx.set(doc(transactionsPath(uid)), {
        ...documentFor({
          kind: difference > 0 ? "gain" : "loss",
          accountId: kind,
          amountCents: Math.abs(difference),
          note: input.note,
          date: input.date,
        }),
        createdAt: serverTimestamp(),
      });
    });
  });
}

/**
 * Live feed of everything recorded from `from` onward.
 *
 * Month balances are derived by taking the running account total and undoing
 * everything dated after the month being viewed. That's what makes a past
 * month immovable: adding an August expense lowers the running total and grows
 * this set by the same entry, so July's closing balance comes out unchanged.
 */
export function subscribeTransactionsFrom(
  uid: string,
  from: Date,
  onChange: (transactions: Transaction[]) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    query(
      transactionsPath(uid),
      where("date", ">=", Timestamp.fromDate(from)),
      orderBy("date", "desc"),
    ),
    (snapshot) => onChange(snapshot.docs.map(toTransaction)),
    onError,
  );
}

/**
 * Live transaction feed for a single month. The range and the sort are both on
 * `date`, which Firestore serves from its automatic single-field index — no
 * composite index to create.
 */
export function subscribeMonthTransactions(
  uid: string,
  monthStart: Date,
  onChange: (transactions: Transaction[]) => void,
  onError: (error: unknown) => void,
) {
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
  );

  return onSnapshot(
    query(
      transactionsPath(uid),
      where("date", ">=", Timestamp.fromDate(monthStart)),
      where("date", "<", Timestamp.fromDate(monthEnd)),
      orderBy("date", "desc"),
    ),
    (snapshot) => onChange(snapshot.docs.map(toTransaction)),
    onError,
  );
}

function toTransaction(document: QueryDocumentSnapshot): Transaction {
  const data = document.data();
  return {
    id: document.id,
    kind: data.kind,
    accountId: data.accountId,
    toAccountId: data.toAccountId ?? null,
    amountCents: data.amountCents ?? 0,
    categoryId: data.categoryId ?? null,
    note: data.note ?? "",
    date: (data.date as Timestamp)?.toDate() ?? new Date(),
  } satisfies Transaction;
}
