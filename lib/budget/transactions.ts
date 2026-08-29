import {
  Timestamp,
  doc,
  writeBatch,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
  type Transaction as FirestoreTransaction,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { BudgetError } from "./error";
import {
  deltasForInput,
  deltasFor,
  type Deltas,
  type EntryInput,
} from "./ledger";
import { normaliseName } from "./accounts";
import { accountDoc, accountsPath, transactionsPath } from "./paths";
import { isDebt, type AccountType, type Transaction, type TransactionKind } from "./types";

export { transactionsPath };
export { BudgetError };
export type { EntryInput };

function readBalance(data: DocumentData | undefined): number {
  return typeof data?.balanceCents === "number" ? data.balanceCents : 0;
}

/** Narrows a stored value to something that could be an account id. */
function toAccountId(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function documentFor(input: EntryInput) {
  const shared = {
    kind: input.kind,
    accountId: input.accountId,
    amountCents: input.amountCents,
    note: input.note,
    date: Timestamp.fromDate(input.date),
  };

  switch (input.kind) {
    case "income":
    case "expense":
      return { ...shared, toAccountId: null, categoryId: input.categoryId };
    case "transfer":
      return {
        ...shared,
        toAccountId: input.toAccountId,
        categoryId: null,
      };
    case "gain":
    case "loss":
      return { ...shared, toAccountId: null, categoryId: null };
  }
}

/** The deltas an already-stored entry applied when it was written. */
function deltasForStored(data: DocumentData): Deltas {
  const accountId = toAccountId(data.accountId);
  if (!accountId) throw new BudgetError("That entry can't be changed.");

  const kind = data.kind as TransactionKind;
  const amountCents =
    typeof data.amountCents === "number" ? data.amountCents : 0;

  if (kind === "transfer") {
    const toId = toAccountId(data.toAccountId);
    if (!toId) throw new BudgetError("That entry can't be changed.");
    return deltasFor(kind, accountId, toId, amountCents);
  }

  return deltasFor(kind, accountId, null, amountCents);
}

function validate(input: EntryInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new BudgetError("Enter an amount greater than zero.");
  }
  if (!input.accountId) {
    throw new BudgetError("Pick an account for this entry.");
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
  const net = new Map<string, number>();
  for (const accountId of new Set([
    ...Object.keys(before),
    ...Object.keys(after),
  ])) {
    const change = (after[accountId] ?? 0) - (before[accountId] ?? 0);
    if (change !== 0) net.set(accountId, change);
  }
  if (net.size === 0) return;

  const touched = [...net.keys()];
  const refs = touched.map((accountId) => accountDoc(uid, accountId));
  const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

  const resulting = new Map<string, number>();
  touched.forEach((accountId, index) => {
    resulting.set(
      accountId,
      readBalance(snapshots[index].data()) + (net.get(accountId) ?? 0),
    );
  });

  // Unlike an expense, a transfer that exceeds the source balance is refused —
  // shuffling money you don't have between your own accounts is always an
  // error, not a record of something that happened.
  if (next?.kind === "transfer") {
    const source = resulting.get(next.accountId);
    // A debt account is *meant* to sit below zero, so "would go negative" says
    // nothing about it — drawing on a credit card is exactly what it's for.
    const sourceIsDebt =
      snapshots[touched.indexOf(next.accountId)]?.data()?.type === "debt";
    if (source !== undefined && source < 0 && !sourceIsDebt) {
      const index = touched.indexOf(next.accountId);
      const stored = snapshots[index]?.data()?.name;
      const name = typeof stored === "string" && stored ? stored : "That account";
      throw new BudgetError(`${name} doesn't have enough to transfer.`);
    }
  }

  touched.forEach((accountId, index) => {
    // Merged, never replaced: the account's name and type are the user's and
    // have nothing to do with settling a balance.
    tx.set(
      refs[index],
      { balanceCents: resulting.get(accountId) ?? 0 },
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

  await runTransaction(db(), async (tx) => {
    await settleBalances(tx, uid, {}, deltasForInput(input), input);
    tx.set(entryRef, { ...documentFor(input), createdAt: serverTimestamp() });
  });
}

/**
 * Writes a run of entries and settles their combined effect, inside a
 * transaction the caller already owns.
 *
 * The combining is the point. A Firestore transaction must finish every read
 * before its first write, so settling each entry in turn would read an account
 * it had already written and be rejected. Summing the deltas first means the
 * accounts are read once however many entries are landing — which is what lets
 * a schedule that has been dormant for a year catch up in a single step.
 *
 * The transfer overdraft check is deliberately skipped: these entries are
 * dated in the past by the time anything posts them, and refusing one would
 * stall the schedule rather than prevent the movement it is recording.
 */
export async function addEntriesInTransaction(
  tx: FirestoreTransaction,
  uid: string,
  entries: EntryInput[],
  extra: Record<string, unknown> = {},
): Promise<void> {
  if (entries.length === 0) return;
  for (const entry of entries) validate(entry);

  const combined: Deltas = {};
  for (const entry of entries) {
    for (const [accountId, delta] of Object.entries(deltasForInput(entry))) {
      combined[accountId] = (combined[accountId] ?? 0) + delta;
    }
  }

  await settleBalances(tx, uid, {}, combined, null);

  for (const entry of entries) {
    tx.set(doc(transactionsPath(uid)), {
      ...documentFor(entry),
      ...extra,
      createdAt: serverTimestamp(),
    });
  }
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

  await runTransaction(db(), async (tx) => {
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

  await runTransaction(db(), async (tx) => {
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
  accountId: string,
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
 * They all move in one transaction: a half-applied opening balance would leave
 * the books wrong with no obvious way for the user to tell which accounts had
 * taken and which hadn't.
 */
export async function setAccountBalances(
  uid: string,
  targets: Record<string, number>,
  input: { note: string; date: Date },
): Promise<void> {
  const entries = Object.entries(targets);
  for (const [, cents] of entries) {
    if (!Number.isInteger(cents)) {
      throw new BudgetError("Enter each balance as an amount, like 1250.00.");
    }
  }

  await runTransaction(db(), async (tx) => {
    const refs = entries.map(([accountId]) => accountDoc(uid, accountId));
    const snapshots = await Promise.all(refs.map((ref) => tx.get(ref)));

    entries.forEach(([accountId, target], index) => {
      const difference = target - readBalance(snapshots[index].data());
      if (difference === 0) return;

      tx.set(refs[index], { balanceCents: target }, { merge: true });
      tx.set(doc(transactionsPath(uid)), {
        ...documentFor({
          kind: difference > 0 ? "gain" : "loss",
          accountId,
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
 * Creates a set of accounts and files what each one already holds, in a single
 * batch.
 *
 * This is onboarding's last step, and it's one write for a reason: a run that
 * stopped halfway would leave someone with three of their five accounts and no
 * way to tell which two never landed. Balances are recorded as ordinary gains
 * rather than written straight onto the account, so even the very first figure
 * has an entry in the history explaining it.
 */
export async function openAccountsWithBalances(
  uid: string,
  entries: { name: string; type: AccountType; balanceCents: number }[],
  input: { note: string; date: Date; orderFrom?: number },
): Promise<void> {
  for (const entry of entries) {
    if (normaliseName(entry.name) === "") {
      throw new BudgetError("Give every account a name.");
    }
    // Debt accounts open below zero — that's what makes them debt. Everything
    // else opening negative would be a typo, not a balance.
    const floorBroken = isDebt(entry.type)
      ? entry.balanceCents > 0
      : entry.balanceCents < 0;
    if (!Number.isInteger(entry.balanceCents) || floorBroken) {
      throw new BudgetError(
        isDebt(entry.type)
          ? "Enter what you owe as an amount, like 2400.00."
          : "Enter each balance as an amount, like 1250.00.",
      );
    }
  }

  const batch = writeBatch(db());

  entries.forEach((entry, index) => {
    const ref = doc(accountsPath(uid));
    batch.set(ref, {
      name: normaliseName(entry.name),
      type: entry.type,
      balanceCents: entry.balanceCents,
      order: (input.orderFrom ?? 0) + index,
    });

    if (entry.balanceCents === 0) return;
    batch.set(doc(transactionsPath(uid)), {
      ...documentFor({
        // A debt opens below zero, and amounts are never signed — so the
        // opening entry for one is a loss of what's owed, not a negative gain.
        kind: entry.balanceCents > 0 ? "gain" : "loss",
        accountId: ref.id,
        amountCents: Math.abs(entry.balanceCents),
        note: input.note,
        date: input.date,
      }),
      createdAt: serverTimestamp(),
    });
  });

  await batch.commit();
}

/**
 * Live feed of everything recorded from `from` onward.
 *
 * One window serves three jobs: the month on screen, everything after it (which
 * is what makes a past month immovable — the running total is rewound by it),
 * and the year of history the growth chart plots. Deriving all three from a
 * single subscription keeps them consistent by construction and costs one
 * listener instead of three overlapping ones.
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
    (snapshot) => onChange(snapshot.docs.map(toTransaction).sort(newestFirst)),
    onError,
  );
}

/**
 * Newest at the top, and newest *recorded* at the top within a day.
 *
 * `orderBy("date", "desc")` gets the days right but can't order inside one:
 * entries are dated by a date input, so every entry on a given day sits at
 * local midnight and ties exactly. Firestore settles a tie on the document
 * id, which is a random auto-id — so an entry added just now would appear at
 * whatever position its id happened to sort to. Ordering the tie by when it
 * was written puts it where the user just put it.
 *
 * Sorted here rather than in the query: a second `orderBy` would need a
 * composite index, and — because `serverTimestamp()` reads back empty until
 * the server acks — would drop a just-added entry out of the result entirely
 * until the round trip finished.
 */
function newestFirst(a: Transaction, b: Transaction): number {
  const byDate = b.date.getTime() - a.date.getTime();
  if (byDate !== 0) return byDate;
  return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
}

function toTransaction(document: QueryDocumentSnapshot): Transaction {
  const data = document.data();
  const created = data.createdAt as Timestamp | undefined;
  return {
    id: document.id,
    kind: data.kind,
    accountId: data.accountId ?? "",
    toAccountId: data.toAccountId ?? null,
    amountCents: data.amountCents ?? 0,
    categoryId: data.categoryId ?? null,
    note: data.note ?? "",
    date: (data.date as Timestamp)?.toDate() ?? new Date(),
    // `serverTimestamp()` reads back empty on the local snapshot that fires
    // the instant an entry is added, and an entry with no time to sort by
    // would sink to the bottom of its day and then jump to the top when the
    // server acked. It was written now, so say so and let it stay put.
    createdAt:
      created?.toDate() ??
      (document.metadata.hasPendingWrites ? new Date() : null),
    recurringId:
      typeof data.recurringId === "string" ? data.recurringId : null,
  } satisfies Transaction;
}
