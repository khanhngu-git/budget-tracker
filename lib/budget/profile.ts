import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export function profileDoc(uid: string) {
  return doc(db(), "users", uid);
}

export type Profile = {
  /** Set once the user has answered the opening-balance prompt. */
  openingBalancesSet: boolean;
};

/**
 * Whether onboarding has happened, kept as an explicit flag rather than
 * inferred from the balances.
 *
 * "All three accounts are zero" is not the same question: someone can
 * genuinely start at zero, and inferring from the numbers would prompt them
 * again on every load with no way to say "yes, really".
 */
export function subscribeProfile(
  uid: string,
  onChange: (profile: Profile) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    profileDoc(uid),
    (snapshot) => {
      onChange({
        openingBalancesSet: snapshot.data()?.openingBalancesSet === true,
      });
    },
    onError,
  );
}

/** Puts the prompt back, for a user who has just wiped their data. */
export async function markOpeningBalancesUnset(uid: string): Promise<void> {
  await setDoc(profileDoc(uid), { openingBalancesSet: false }, { merge: true });
}

export async function markOpeningBalancesSet(uid: string): Promise<void> {
  await setDoc(
    profileDoc(uid),
    { openingBalancesSet: true, openingBalancesSetAt: serverTimestamp() },
    { merge: true },
  );
}
