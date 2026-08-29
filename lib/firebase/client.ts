import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

/* ── Sessions, plural ───────────────────────────────────────────────────
   A Firebase `Auth` instance holds exactly one signed-in user, which is why
   switching accounts used to mean signing out — and signing back in with a
   password every time you went the other way.

   What it *doesn't* mean is one session per browser. Auth persists its user
   under a key that includes the Firebase app's name, so two named apps built
   from the same config keep two entirely independent, independently persisted
   sessions. A slot is one such app. Switching accounts is then choosing which
   slot is live: nobody is signed out, and coming back is instant.

   Firestore has to follow the same slot, because the token it attaches to
   every read is the slot's token — a `db` from one app with an `auth` from
   another would query as the wrong person, or as nobody. That is why `db()`
   and `firebaseAuth()` are functions rather than the constants they were:
   they resolve against whichever slot is live at the moment they're called. */

/** The default app's name, and the slot every existing session already lives in. */
const FIRST_SLOT = "[DEFAULT]";

/**
 * As many accounts as one browser is plausibly shared by, and the same cap the
 * account menu remembers. Each costs a Firebase app and its own Firestore
 * connection once it is used, so this is not a number to grow idly.
 */
export const SLOTS = [FIRST_SLOT, "session-2", "session-3", "session-4", "session-5"];

const ACTIVE_KEY = "budget-tracker:active-slot";

function appFor(slot: string): FirebaseApp {
  // Next.js re-evaluates modules on hot reload, so reuse an app that exists.
  const existing = getApps().find((app) => app.name === slot);
  if (existing) return existing;
  return slot === FIRST_SLOT
    ? initializeApp(firebaseConfig)
    : initializeApp(firebaseConfig, slot);
}

function readActive(): string {
  if (typeof localStorage === "undefined") return FIRST_SLOT;
  try {
    const stored = localStorage.getItem(ACTIVE_KEY);
    return stored && SLOTS.includes(stored) ? stored : FIRST_SLOT;
  } catch {
    return FIRST_SLOT;
  }
}

let active = readActive();
const listeners = new Set<() => void>();

export function activeSlot(): string {
  return active;
}

/**
 * Makes a slot live.
 *
 * Nothing is signed out and nothing is written to Firestore — this only
 * changes which of the browser's sessions the app is looking through. The
 * providers above re-subscribe on the change, which is what makes the whole
 * dashboard reload as the other person.
 */
export function setActiveSlot(slot: string): void {
  if (!SLOTS.includes(slot) || slot === active) return;
  active = slot;
  try {
    localStorage.setItem(ACTIVE_KEY, slot);
  } catch {
    // Private browsing: the switch still works, it just won't outlive the tab.
  }
  for (const listener of listeners) listener();
}

export function subscribeActiveSlot(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Server render has no `localStorage`, so it is always on the first slot. */
export function serverSlot(): string {
  return FIRST_SLOT;
}

export function authFor(slot: string): Auth {
  return getAuth(appFor(slot));
}

/** The signed-in session the app is currently acting as. */
export function firebaseAuth(): Auth {
  return authFor(active);
}

/**
 * Firestore for the live slot.
 *
 * A function, not a constant: every path helper calls it at the moment it
 * builds a reference, so a listener opened before a switch keeps the instance
 * it was opened with — and unsubscribes cleanly — while everything opened
 * after the switch reads as the new user.
 */
export function db(): Firestore {
  return getFirestore(appFor(active));
}
