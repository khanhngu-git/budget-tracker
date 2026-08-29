import {
  Timestamp,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { BudgetError } from "./error";
import { startOfDay } from "./format";
import type { EntryInput } from "./ledger";
import { accountsPath, recurringDoc, recurringPath } from "./paths";
import { dueOccurrences, type Frequency } from "./recurrence";
import { addEntriesInTransaction, addTransaction } from "./transactions";
import type { RecurringKind, RecurringRule } from "./types";

export type RecurringInput = {
  kind: RecurringKind;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  amountCents: number;
  note: string;
  frequency: Frequency;
  startDate: Date;
  /** null means "until further notice". */
  endDate: Date | null;
};

function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null;
}

function toRule(id: string, data: DocumentData): RecurringRule {
  return {
    id,
    kind: data.kind,
    accountId: data.accountId ?? "",
    toAccountId: data.toAccountId ?? null,
    categoryId: data.categoryId ?? null,
    amountCents: data.amountCents ?? 0,
    note: data.note ?? "",
    frequency: data.frequency,
    startDate: toDate(data.startDate) ?? new Date(),
    endDate: toDate(data.endDate),
    lastRunDate: toDate(data.lastRunDate),
    // A rule written before pausing existed is running, not paused.
    active: data.active !== false,
  };
}

function validate(input: RecurringInput) {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new BudgetError("Enter an amount greater than zero.");
  }
  if (!input.accountId) {
    throw new BudgetError("Pick an account for this entry.");
  }
  if (input.kind === "transfer" && input.accountId === input.toAccountId) {
    throw new BudgetError("Pick two different accounts.");
  }
  if (
    input.endDate &&
    startOfDay(input.endDate).getTime() < startOfDay(input.startDate).getTime()
  ) {
    throw new BudgetError("The end date can't be before the first one.");
  }
}

function documentFor(input: RecurringInput) {
  return {
    kind: input.kind,
    accountId: input.accountId,
    toAccountId: input.kind === "transfer" ? input.toAccountId : null,
    categoryId: input.kind === "transfer" ? null : input.categoryId,
    amountCents: input.amountCents,
    note: input.note,
    frequency: input.frequency,
    startDate: Timestamp.fromDate(startOfDay(input.startDate)),
    endDate: input.endDate
      ? Timestamp.fromDate(startOfDay(input.endDate))
      : null,
  };
}

/** The entry one occurrence of a rule posts. */
function entryFor(rule: RecurringRule, date: Date): EntryInput {
  const shared = { amountCents: rule.amountCents, note: rule.note, date };

  if (rule.kind === "transfer") {
    return {
      kind: "transfer",
      accountId: rule.accountId,
      toAccountId: rule.toAccountId ?? "",
      ...shared,
    };
  }
  return {
    kind: rule.kind,
    accountId: rule.accountId,
    categoryId: rule.categoryId ?? "",
    ...shared,
  };
}

/**
 * The rule that would repeat this entry, or null if it can't be repeated.
 *
 * Switched on the kind rather than tested with a chain of conditions, which is
 * what tells the compiler which fields each branch actually has.
 */
function scheduleFor(
  entry: EntryInput,
  repeat: { frequency: Frequency; endDate: Date | null },
): RecurringInput | null {
  const shared = {
    accountId: entry.accountId,
    amountCents: entry.amountCents,
    note: entry.note,
    frequency: repeat.frequency,
    startDate: entry.date,
    endDate: repeat.endDate,
  };

  switch (entry.kind) {
    case "income":
    case "expense":
      return {
        ...shared,
        kind: entry.kind,
        toAccountId: null,
        categoryId: entry.categoryId,
      };
    case "transfer":
      return {
        ...shared,
        kind: entry.kind,
        toAccountId: entry.toAccountId,
        categoryId: null,
      };
    // Adjustments record movement nobody made — interest, a market swing —
    // which is precisely the thing you can't know the size of in advance.
    case "gain":
    case "loss":
      return null;
  }
}

/**
 * Records an entry and, if it repeats, the schedule that will record it again.
 *
 * Both in one transaction: a schedule whose first entry never landed, or an
 * entry whose schedule was silently dropped, are both worse than the write
 * simply failing.
 *
 * The rule is seeded with `lastRunDate` set to this entry's own date, which is
 * what stops the catch-up posting today's salary a second time the moment the
 * dialog closes. The first occurrence is the entry in front of the user; the
 * schedule takes over from the next one.
 */
export async function addEntryWithSchedule(
  uid: string,
  entry: EntryInput,
  repeat: { frequency: Frequency; endDate: Date | null } | null,
): Promise<void> {
  const input = repeat ? scheduleFor(entry, repeat) : null;

  // Nothing to repeat, or a kind that can't be: an ordinary entry, then.
  if (!input) {
    await addTransaction(uid, entry);
    return;
  }
  validate(input);

  const ruleRef = doc(recurringPath(uid));

  await runTransaction(db(), async (tx) => {
    await addEntriesInTransaction(tx, uid, [entry], { recurringId: ruleRef.id });
    tx.set(ruleRef, {
      ...documentFor(input),
      lastRunDate: Timestamp.fromDate(startOfDay(entry.date)),
      active: true,
      createdAt: serverTimestamp(),
    });
  });
}

export function subscribeRecurring(
  uid: string,
  onChange: (rules: RecurringRule[]) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    query(recurringPath(uid), orderBy("startDate", "asc")),
    (snapshot) =>
      onChange(
        snapshot.docs.map((document: QueryDocumentSnapshot) =>
          toRule(document.id, document.data()),
        ),
      ),
    onError,
  );
}

/**
 * Creates a rule, or rewrites one.
 *
 * `lastRunDate` is never touched here. Editing an amount is not a reason to
 * re-post the months a schedule has already paid out, and clearing it would do
 * exactly that the next time the app opened.
 */
export async function saveRecurringRule(
  uid: string,
  ruleId: string | null,
  input: RecurringInput,
): Promise<void> {
  validate(input);

  if (ruleId) {
    await updateDoc(recurringDoc(uid, ruleId), documentFor(input));
    return;
  }

  await setDoc(doc(recurringPath(uid)), {
    ...documentFor(input),
    lastRunDate: null,
    active: true,
    createdAt: serverTimestamp(),
  });
}

export async function setRecurringActive(
  uid: string,
  ruleId: string,
  active: boolean,
): Promise<void> {
  await updateDoc(recurringDoc(uid, ruleId), { active });
}

/**
 * Deletes the rule and nothing else.
 *
 * The entries it already posted stay. They are a record of money that actually
 * moved, and cancelling a standing order at the bank has never refunded last
 * month's rent either.
 */
export async function deleteRecurringRule(
  uid: string,
  ruleId: string,
): Promise<void> {
  await deleteDoc(recurringDoc(uid, ruleId));
}

/**
 * Posts everything the user's schedules owe, up to today.
 *
 * There is no server in this app, so "when the day comes" means the first time
 * the app is opened on or after that day — the entries are dated the day they
 * were due, not the day they were noticed, so a salary that landed on the 1st
 * reads as the 1st however late you look.
 *
 * Each rule settles in its own Firestore transaction, which re-reads
 * `lastRunDate` inside the transaction and advances it in the same write. Two
 * tabs opening at once, a reload mid-run, an effect firing twice in
 * development: the second attempt re-reads a date that has already moved and
 * finds nothing due.
 */
export async function catchUpRecurring(
  uid: string,
  now: Date = new Date(),
): Promise<number> {
  const [rules, accounts] = await Promise.all([
    getDocs(query(recurringPath(uid), where("active", "==", true))),
    getDocs(accountsPath(uid)),
  ]);

  const live = new Set(accounts.docs.map((account) => account.id));
  let posted = 0;

  for (const document of rules.docs) {
    const rule = toRule(document.id, document.data());

    // An account the user has since deleted would otherwise be recreated as a
    // bare balance by the settling write. Leave the rule alone and visible —
    // the list shows it as broken — rather than silently posting into a ghost.
    if (!live.has(rule.accountId)) continue;
    if (rule.kind === "transfer" && !live.has(rule.toAccountId ?? "")) continue;

    posted += await runRule(uid, rule.id, now);
  }

  return posted;
}

async function runRule(
  uid: string,
  ruleId: string,
  now: Date,
): Promise<number> {
  return runTransaction(db(), async (tx) => {
    const ref = recurringDoc(uid, ruleId);
    const snapshot = await tx.get(ref);
    if (!snapshot.exists()) return 0;

    const rule = toRule(ruleId, snapshot.data());
    if (!rule.active) return 0;

    const due = dueOccurrences(rule, now);
    if (due.length === 0) return 0;

    const entries = due.map((date) => entryFor(rule, date));
    await addEntriesInTransaction(tx, uid, entries, { recurringId: ruleId });

    // Advanced to the last occurrence actually written, not to today: a run
    // that hit the per-run ceiling has to resume from where it stopped.
    tx.update(ref, {
      lastRunDate: Timestamp.fromDate(due[due.length - 1]),
    });

    return entries.length;
  });
}
