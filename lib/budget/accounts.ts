import {
  addDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { BudgetError } from "./error";
import { accountDoc, accountsPath, transactionsPath } from "./paths";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  type Account,
  type AccountType,
} from "./types";

export { accountDoc, accountsPath };

/**
 * One-tap starting points for the add-account form; all of it stays editable.
 *
 * Ordered by how many people have one, not by type — the account almost
 * everyone opens with is the one that should be under the cursor. Anything
 * that is really a *named* instance of one of these ("Emergency fund" is a
 * savings account, "Pension" an investments one) is left out: it would be a
 * second tile doing nothing the first can't, and the name is editable anyway.
 */
export const ACCOUNT_PRESETS: { name: string; type: AccountType }[] = [
  { name: "Debit Account", type: "spending" },
  { name: "Cash", type: "cash" },
  { name: "Savings", type: "savings" },
  { name: "Credit Card", type: "debt" },
  { name: "Investments", type: "investments" },
  { name: "Loan", type: "debt" },
  { name: "Mortgage", type: "debt" },
];

export const MAX_ACCOUNT_NAME = 32;

function readBalance(data: DocumentData | undefined): number {
  return typeof data?.balanceCents === "number" ? data.balanceCents : 0;
}

/**
 * Reads a stored account, filling in anything an older document doesn't carry.
 *
 * The first build had exactly three accounts whose document id *was* their
 * type and which stored no name at all. Rather than gate the whole app behind
 * a migration, every read tolerates that shape — so the UI is correct on the
 * very first snapshot, before `backfillAccounts` has written anything back.
 */
function toAccount(
  id: string,
  data: DocumentData,
  fallbackOrder: number,
): Account {
  const stored = [data.type, data.kind].find((value) =>
    ACCOUNT_TYPES.includes(value as AccountType),
  ) as AccountType | undefined;
  const type = stored ?? "spending";

  const name =
    typeof data.name === "string" && data.name.trim() !== ""
      ? data.name.trim()
      : ACCOUNT_TYPE_LABELS[type];

  return {
    id,
    name,
    type,
    balanceCents: readBalance(data),
    order: typeof data.order === "number" ? data.order : fallbackOrder,
    // Absent on every account written before targets existed, and on every
    // account the user hasn't set one for — both mean the same thing here.
    targetCents:
      typeof data.targetCents === "number" && data.targetCents > 0
        ? data.targetCents
        : null,
  };
}

function byPosition(a: Account, b: Account): number {
  return a.order - b.order || a.name.localeCompare(b.name);
}

export function normaliseName(name: string): string {
  return name.trim().slice(0, MAX_ACCOUNT_NAME);
}

/**
 * Brings documents written by an older build up to the nameable shape.
 *
 * Nothing is created here. A new user picks their own accounts during
 * onboarding, because guessing three for them means everyone starts with a
 * "Savings" they may not have and has to work out that it's safe to delete.
 *
 * Safe to call on every load: an existing balance is never written, and the
 * backfill only ever adds the fields it finds missing.
 */
export async function backfillAccounts(uid: string): Promise<void> {
  const existing = await getDocs(accountsPath(uid));
  if (existing.empty) return;

  const batch = writeBatch(db);
  let pending = 0;

  existing.docs.forEach((snapshot, index) => {
    const data = snapshot.data();
    const account = toAccount(snapshot.id, data, index);
    const patch: Record<string, unknown> = {};

    if (typeof data.name !== "string" || data.name.trim() === "") {
      patch.name = account.name;
    }
    if (!ACCOUNT_TYPES.includes(data.type as AccountType)) {
      patch.type = account.type;
    }
    if (typeof data.order !== "number") patch.order = account.order;

    if (Object.keys(patch).length > 0) {
      batch.update(snapshot.ref, patch);
      pending += 1;
    }
  });

  if (pending > 0) await batch.commit();
}

export function subscribeAccounts(
  uid: string,
  onChange: (accounts: Account[]) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    accountsPath(uid),
    (snapshot) => {
      const accounts = snapshot.docs.map((document, index) =>
        toAccount(document.id, document.data(), index),
      );
      onChange(accounts.sort(byPosition));
    },
    onError,
  );
}

export async function createAccount(
  uid: string,
  input: { name: string; type: AccountType; order: number },
): Promise<string> {
  const name = normaliseName(input.name);
  if (name === "") throw new BudgetError("Give the account a name.");

  const created = await addDoc(accountsPath(uid), {
    name,
    type: input.type,
    balanceCents: 0,
    order: input.order,
  });
  return created.id;
}

export async function updateAccount(
  uid: string,
  accountId: string,
  input: { name: string; type: AccountType },
): Promise<void> {
  const name = normaliseName(input.name);
  if (name === "") throw new BudgetError("Give the account a name.");

  await updateDoc(accountDoc(uid, accountId), { name, type: input.type });
}

/** Renames an account without touching anything else about it. */
export async function renameAccount(
  uid: string,
  accountId: string,
  rawName: string,
): Promise<void> {
  const name = normaliseName(rawName);
  if (name === "") throw new BudgetError("Give the account a name.");

  await updateDoc(accountDoc(uid, accountId), { name });
}

/**
 * Sets or clears what an account is saving up to.
 *
 * Written on its own rather than through {@link updateAccount} so that setting
 * a target can't quietly rewrite the name and type alongside it — the two are
 * edited from different places and would otherwise race.
 */
export async function setAccountTarget(
  uid: string,
  accountId: string,
  targetCents: number | null,
): Promise<void> {
  if (targetCents !== null && (!Number.isInteger(targetCents) || targetCents <= 0)) {
    throw new BudgetError("Enter a target greater than zero.");
  }

  await updateDoc(accountDoc(uid, accountId), {
    targetCents: targetCents ?? deleteField(),
  });
}

/**
 * Removes an account, but only once nothing depends on it.
 *
 * Deleting an account that still holds money would make that money vanish from
 * the totals with no entry explaining where it went, and deleting one with
 * history would strand every transaction that points at it — the ledger would
 * still move balances for an account nothing can name. Both are refused with
 * the fix stated, rather than silently cascaded.
 */
export async function deleteAccount(
  uid: string,
  accountId: string,
): Promise<void> {
  const snapshot = await getDoc(accountDoc(uid, accountId));
  if (!snapshot.exists()) return;

  const balanceCents = readBalance(snapshot.data());
  if (balanceCents < 0) {
    throw new BudgetError(
      "There's still a balance owed on this account. Pay it off with a transfer first, then remove it.",
    );
  }
  if (balanceCents !== 0) {
    throw new BudgetError(
      "This account still holds money. Transfer it somewhere else first, then remove the account.",
    );
  }

  const [asSource, asDestination] = await Promise.all([
    getDocs(
      query(transactionsPath(uid), where("accountId", "==", accountId), limit(1)),
    ),
    getDocs(
      query(
        transactionsPath(uid),
        where("toAccountId", "==", accountId),
        limit(1),
      ),
    ),
  ]);

  if (!asSource.empty || !asDestination.empty) {
    throw new BudgetError(
      "This account has entries in your history, so removing it would leave them pointing at nothing. Rename it instead.",
    );
  }

  await deleteDoc(accountDoc(uid, accountId));
}
