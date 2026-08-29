"use client";

/**
 * The people who have signed in on this device.
 *
 * Each one names the session slot it is signed in on — the Firebase app whose
 * persisted session belongs to them — which is what lets a switch be a click
 * rather than a password. The slot is where the session actually lives; this
 * list is only the address book that says whose it is.
 *
 * Deliberately nothing but a display name, an address and a slot name, and
 * deliberately only in `localStorage`: no token, no password, nothing that
 * grants access on its own. Clearing it loses the shortcut, never the account.
 * The list is per-device by design — it describes this browser, not the user.
 */

import { SLOTS, authFor } from "@/lib/firebase/client";

const KEY = "budget-tracker:known-accounts";

/** One per session slot: an account with nowhere to live can't be switched to. */
const MAX = SLOTS.length;

export type KnownAccount = {
  uid: string;
  email: string;
  /** Whatever the app knew them as last time. May be empty. */
  name: string;
  /**
   * The Firebase app whose persisted session is this account's, or "" when we
   * don't know — an entry written before slots existed, or one whose session
   * has since been claimed by somebody else. Unknown is not a broken state: it
   * means "this one needs a password", which is a fine thing to offer.
   */
  slot: string;
};

const listeners = new Set<() => void>();

/** Cached so `useSyncExternalStore` gets a stable snapshot between writes. */
let cache: KnownAccount[] | null = null;

function parse(raw: string | null): KnownAccount[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(
        (entry): entry is KnownAccount =>
          typeof entry?.uid === "string" &&
          entry.uid !== "" &&
          typeof entry?.email === "string",
      )
      .map((entry) => ({
        uid: entry.uid,
        email: entry.email,
        name: typeof entry.name === "string" ? entry.name : "",
        // Never guessed. An entry written before slots existed has no idea
        // which session is its own, and defaulting it to the first slot was
        // exactly the bug that made switching a no-op: two accounts both
        // claiming the live slot, so "switch" resolved to where you already
        // were. Unknown stays unknown until a real sign-in records it.
        slot: SLOTS.includes(entry.slot) ? entry.slot : "",
      }))
      .slice(0, MAX);
  } catch {
    // Someone else's key, or a half-written value. Not worth a broken menu.
    return [];
  }
}

function write(accounts: KnownAccount[]) {
  cache = accounts;
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts));
  } catch {
    // Private browsing, or a full quota. The menu simply won't remember.
  }
  for (const listener of listeners) listener();
}

export function knownAccounts(): KnownAccount[] {
  if (cache) return cache;
  if (typeof localStorage === "undefined") return (cache = []);
  return (cache = parse(localStorage.getItem(KEY)));
}

/**
 * Records — or refreshes — one account, most recent first.
 *
 * Called both when a session appears and whenever the signed-in user's own
 * display name changes, so the menu never offers to switch to a name they
 * stopped using three renames ago.
 */
export function rememberAccount(account: KnownAccount): void {
  if (typeof localStorage === "undefined") return;
  const current = knownAccounts();
  const existing = current.find((entry) => entry.uid === account.uid);
  if (
    existing &&
    current[0]?.uid === account.uid &&
    existing.email === account.email &&
    existing.name === account.name &&
    existing.slot === account.slot
  ) {
    return;
  }

  // Keyed by uid *and* by slot: signing in as someone on a second slot moves
  // them to it, and whatever used to hold that slot is displaced — two entries
  // pointing at one session would make the menu offer the same click twice.
  write(
    [
      account,
      ...current.filter(
        (entry) =>
          entry.uid !== account.uid &&
          // "" is "no slot", which every unrecorded entry shares — it can't be
          // a collision, or the first sign-in would evict all of them.
          (entry.slot === "" || entry.slot !== account.slot),
      ),
    ].slice(0, MAX),
  );
}

/** Who is signed in on a slot right now, or null. Restores it if need be. */
export async function occupantOf(slot: string): Promise<string | null> {
  if (!SLOTS.includes(slot)) return null;
  try {
    const auth = authFor(slot);
    // A persisted session is restored asynchronously; asking before it lands
    // reports an empty slot that is about to be occupied.
    await auth.authStateReady();
    return auth.currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

/**
 * A slot with nobody in it, for signing in as somebody new.
 *
 * Decided by asking the sessions themselves rather than by reading the address
 * book. The book can be stale — cleared, edited, or written by a build that
 * didn't record slots — and trusting it would hand out a slot somebody is
 * still signed in on, ending their session to start another.
 *
 * When every slot really is occupied the last is recycled, and whoever was
 * there is signed out by the sign-in that follows. Five accounts on one
 * browser is already generous, and refusing a sixth outright would be a dead
 * end with no way out of it.
 */
export async function emptySlot(): Promise<string> {
  for (const slot of SLOTS) {
    if ((await occupantOf(slot)) === null) return slot;
  }
  return SLOTS[SLOTS.length - 1];
}

export function forgetAccount(uid: string): void {
  if (typeof localStorage === "undefined") return;
  write(knownAccounts().filter((entry) => entry.uid !== uid));
}

export function subscribeKnownAccounts(listener: () => void): () => void {
  listeners.add(listener);
  // Another tab signing in should show up here too.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== KEY) return;
    cache = null;
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** Server render has no `localStorage`, so it has no remembered accounts. */
export const NO_ACCOUNTS: KnownAccount[] = [];
