import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { ACCOUNT_KINDS, type Account, type AccountKind } from "./types";

export function accountsPath(uid: string) {
  return collection(db, "users", uid, "accounts");
}

export function accountDoc(uid: string, kind: AccountKind) {
  return doc(db, "users", uid, "accounts", kind);
}

/**
 * Creates any of the three accounts that don't exist yet, at a zero balance.
 * Safe to call on every load: existing accounts are left untouched, so a
 * balance is never reset.
 */
export async function ensureAccounts(uid: string): Promise<void> {
  const existing = await getDocs(accountsPath(uid));
  const present = new Set(existing.docs.map((snapshot) => snapshot.id));
  const missing = ACCOUNT_KINDS.filter((kind) => !present.has(kind));
  if (missing.length === 0) return;

  const batch = writeBatch(db);
  for (const kind of missing) {
    batch.set(accountDoc(uid, kind), { kind, balanceCents: 0 });
  }
  await batch.commit();
}

export function subscribeAccounts(
  uid: string,
  onChange: (accounts: Record<AccountKind, Account>) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    accountsPath(uid),
    (snapshot) => {
      // Start from zeroed accounts so the UI has all three even on the first
      // snapshot, before ensureAccounts() has committed.
      const accounts = Object.fromEntries(
        ACCOUNT_KINDS.map((kind) => [kind, { kind, balanceCents: 0 }]),
      ) as Record<AccountKind, Account>;

      for (const document of snapshot.docs) {
        const kind = document.id as AccountKind;
        if (!ACCOUNT_KINDS.includes(kind)) continue;
        const data = document.data();
        accounts[kind] = {
          kind,
          balanceCents:
            typeof data.balanceCents === "number" ? data.balanceCents : 0,
        };
      }
      onChange(accounts);
    },
    onError,
  );
}
