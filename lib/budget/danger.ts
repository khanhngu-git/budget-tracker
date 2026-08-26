import {
  collection,
  deleteDoc,
  getDocs,
  writeBatch,
  type DocumentReference,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { goalsPath } from "./goals";
import { markOpeningBalancesUnset, profileDoc } from "./profile";
import { accountsPath, transactionsPath } from "./paths";
import { monthKey } from "./format";

/**
 * Throwing everything away — deliberately, and all the way.
 *
 * Both operations here are irreversible and there is no undo anywhere in the
 * app, so the confirmation that guards them is the whole safety mechanism.
 * That belongs in the UI; what belongs here is being *thorough*, because a
 * half-finished wipe is worse than none: it leaves transactions pointing at
 * accounts that no longer exist and balances nothing can explain.
 */

/** Firestore refuses a batch of more than 500 writes. */
const BATCH_LIMIT = 400;

async function deleteAll(refs: DocumentReference[]): Promise<void> {
  for (let index = 0; index < refs.length; index += BATCH_LIMIT) {
    const batch = writeBatch(db);
    for (const ref of refs.slice(index, index + BATCH_LIMIT)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

/** The build before month-scoped plans kept goals directly under `budgets/`. */
function legacyBudgetsPath(uid: string) {
  return collection(db, "users", uid, "budgets");
}

function shift(month: string, delta: number): string {
  const [year, index] = month.split("-").map(Number);
  return monthKey(new Date(year, index - 1 + delta, 1));
}

/**
 * The months a plan could plausibly be stored under.
 *
 * Goal documents live in `budgets/{month}/goals`, a subcollection whose parent
 * document is never written — and the client SDK cannot list subcollections, so
 * there is no query that returns "every month this user has a plan for". The
 * months have to be guessed, and guessing narrowly would silently strand a
 * plan behind a deleted ledger.
 *
 * So the net is cast wide: every month the ledger touches, a year either side
 * of that span, and a year either side of today — which is as far as the month
 * switcher can realistically have carried anyone.
 */
function candidateMonths(dates: Date[]): string[] {
  const months = new Set<string>();
  const spread = (month: string) => {
    for (let delta = -12; delta <= 12; delta += 1) months.add(shift(month, delta));
  };

  for (const date of dates) months.add(monthKey(date));
  spread(monthKey(new Date()));

  const sorted = [...months].sort();
  if (sorted.length > 0) {
    spread(sorted[0]);
    spread(sorted[sorted.length - 1]);
  }

  return [...months];
}

/**
 * Deletes every transaction, account and monthly plan, and puts the user back
 * where a brand-new sign-up starts — onboarding included.
 *
 * Preferences survive on purpose: currency, theme and name are not the data
 * being reset, and making someone set them up again would be a second, unasked
 * consequence of the button they pressed.
 */
export async function resetBudgetData(uid: string): Promise<void> {
  const [ledger, accounts, legacy] = await Promise.all([
    getDocs(transactionsPath(uid)),
    getDocs(accountsPath(uid)),
    getDocs(legacyBudgetsPath(uid)),
  ]);

  const dates = ledger.docs
    .map((entry) => entry.data().date?.toDate?.())
    .filter((date): date is Date => date instanceof Date);

  const months = candidateMonths(dates);
  const goalDocs: DocumentReference[] = [];

  // In waves rather than all at once: a wide net over a year of empty months
  // is still ~50 reads, and firing them in one go is how you meet a rate limit.
  for (let index = 0; index < months.length; index += 10) {
    const wave = await Promise.all(
      months
        .slice(index, index + 10)
        .map((month) => getDocs(goalsPath(uid, month))),
    );
    for (const snapshot of wave) {
      for (const goal of snapshot.docs) goalDocs.push(goal.ref);
    }
  }

  // Transactions first: while they exist they are the only record explaining
  // the balances, so an interrupted wipe that has already removed the accounts
  // would leave entries pointing at nothing.
  await deleteAll(ledger.docs.map((entry) => entry.ref));
  await deleteAll(goalDocs);
  await deleteAll(legacy.docs.map((entry) => entry.ref));
  await deleteAll(accounts.docs.map((entry) => entry.ref));

  // Back to the state a new sign-up is in, so the opening-balances prompt runs
  // again rather than leaving someone with no accounts and no way to be asked.
  await markOpeningBalancesUnset(uid);
}

/**
 * Everything `resetBudgetData` removes, plus the preferences and the user
 * document itself.
 *
 * Deleting the Firebase Auth user is the caller's job — it needs a recent
 * sign-in, and failing that half-way through would leave an account with no
 * data behind. Data first, credentials last, so a failure at the final step
 * leaves someone who can still sign in and try again.
 */
export async function deleteAllUserData(uid: string): Promise<void> {
  await resetBudgetData(uid);
  await deleteDoc(profileDoc(uid));
}
