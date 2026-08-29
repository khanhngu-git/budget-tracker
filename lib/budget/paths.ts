import { collection, doc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

/**
 * Every collection path in one place.
 *
 * Accounts and transactions reference each other — a transaction settles an
 * account, and deleting an account has to check the ledger first — so keeping
 * the paths here is what stops those two modules importing each other in a
 * circle.
 */

export function accountsPath(uid: string) {
  return collection(db(), "users", uid, "accounts");
}

export function accountDoc(uid: string, accountId: string) {
  return doc(db(), "users", uid, "accounts", accountId);
}

export function transactionsPath(uid: string) {
  return collection(db(), "users", uid, "transactions");
}

export function recurringPath(uid: string) {
  return collection(db(), "users", uid, "recurring");
}

export function recurringDoc(uid: string, ruleId: string) {
  return doc(db(), "users", uid, "recurring", ruleId);
}
