import { FirebaseError } from "firebase/app";

/** Thrown for rule violations we want to surface verbatim in the UI. */
export class BudgetError extends Error {}

/**
 * Turns a failed write into something the reader can act on.
 *
 * The case worth separating is `permission-denied`. Every write in this app
 * goes straight from the browser to Firestore, so the security rules are the
 * only server-side validation there is — which means a rule that has fallen
 * behind the code looks exactly like a bug in the feature. Paying-off goals
 * were precisely that: `debt` was a scope the app could set months before it
 * was a scope the deployed rules would accept, and the failure read as
 * "couldn't save that goal", pointing at everything except the cause.
 *
 * Naming it costs one sentence and turns an unfixable mystery into
 * `firebase deploy --only firestore:rules`.
 */
export function writeErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof BudgetError) return caught.message;
  if (caught instanceof FirebaseError && caught.code === "permission-denied") {
    return "Your Firestore rules rejected that write. If you've just updated the app, deploy the rules again — the ones in the project are older than this feature.";
  }
  return fallback;
}
