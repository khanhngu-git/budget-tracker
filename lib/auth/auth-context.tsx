"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { FirebaseError } from "firebase/app";
import {
  activeSlot,
  authFor,
  firebaseAuth,
  serverSlot,
  subscribeActiveSlot,
} from "@/lib/firebase/client";
import { EmailNotVerifiedError } from "./errors";
import { rememberAccount } from "./known-accounts";

type AuthContextValue = {
  user: User | null;
  /** Which of the browser's sessions the app is currently acting as. */
  slot: string;
  /** True until Firebase has restored (or ruled out) a persisted session. */
  loading: boolean;
  /** Creates the account, emails a verification link, and leaves them signed out. */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Throws {@link EmailNotVerifiedError} until the address has been confirmed. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Google OAuth popup — used for both sign-up and sign-in. */
  signInWithGoogle: () => Promise<void>;
  /** Emails a reset link. Resolves the same way whether or not the address
      has an account, so it can't be used to find out which addresses do. */
  resetPassword: (email: string) => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Firebase mutates the User object in place (e.g. on updateProfile), so it
  // can't drive re-renders on its own. Wrapping it gives every update a fresh
  // identity that React will notice.
  // Carries the slot it was loaded for, so "is this the current answer?" is
  // decided during render rather than by resetting state from inside an effect.
  const [session, setSession] = useState<{ slot: string; user: User | null }>({
    slot: "",
    user: null,
  });
  const [loading, setLoading] = useState(true);

  /**
   * The live session slot.
   *
   * Every method below reaches for `firebaseAuth()` at the moment it is
   * called, so they need no notice of a switch — but the subscription does,
   * which is what this is here to give it.
   */
  const slot = useSyncExternalStore(subscribeActiveSlot, activeSlot, serverSlot);

  // A switch is a fresh question — who is signed in over here? — and until the
  // new slot's persisted session has been restored, the honest answer is
  // "still finding out". Done on the render the slot changes on, so the
  // signed-out header never flashes and the route guard never bounces a switch
  // to /login mid-restore.
  if (session.slot !== slot) {
    setSession({ slot, user: null });
    setLoading(true);
  }

  useEffect(() => {
    return onAuthStateChanged(authFor(slot), (nextUser) => {
      setSession({ slot, user: nextUser });
      setLoading(false);
      // Noted the moment a session appears, so the account menu can offer to
      // come back to it after someone switches away. Names are refreshed from
      // stored preferences by the menu itself — this is only ever a first
      // sighting, and Firebase's copy of the name may be stale.
      if (nextUser) {
        rememberAccount({
          uid: nextUser.uid,
          email: nextUser.email ?? "",
          name: nextUser.displayName ?? "",
          slot,
        });
      }
    });
  }, [slot]);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { user: created } = await createUserWithEmailAndPassword(
        firebaseAuth(),
        email,
        password,
      );

      const displayName = name.trim();
      if (displayName) await updateProfile(created, { displayName });

      await sendEmailVerification(created);

      // Firebase signs you in as a side effect of creating the account. That
      // would walk an unverified address straight into the app, so the session
      // is dropped again immediately: the link in the inbox is the only way in.
      await signOut(firebaseAuth());
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: signedIn } = await signInWithEmailAndPassword(
      firebaseAuth(),
      email,
      password,
    );

    if (!signedIn.emailVerified) {
      // Send a fresh link before backing out: someone typing their password
      // into a login form is someone who wants in, and the original email is
      // usually the one that got lost. A send that's rate-limited is not worth
      // failing the attempt over — the refusal below is the real answer.
      try {
        await sendEmailVerification(signedIn);
      } catch {
        // Ignored deliberately.
      }
      await signOut(firebaseAuth());
      throw new EmailNotVerifiedError(signedIn.email ?? email);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    // Always show the account chooser rather than silently reusing the last
    // Google session on a shared machine.
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(firebaseAuth(), provider);
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    try {
      await sendPasswordResetEmail(firebaseAuth(), email.trim());
    } catch (caught) {
      // "No such user" is not something a signed-out form is allowed to
      // reveal — it turns the reset box into an account-enumeration oracle.
      // Newer Firebase projects hide it anyway; older ones are hidden here.
      if (
        caught instanceof FirebaseError &&
        (caught.code === "auth/user-not-found" ||
          caught.code === "auth/invalid-recipient-email")
      ) {
        return;
      }
      throw caught;
    }
  }, []);

  const logOut = useCallback(async () => {
    await signOut(firebaseAuth());
  }, []);

  const value = useMemo(
    () => ({
      user: session.slot === slot ? session.user : null,
      slot,
      loading,
      signUp,
      signIn,
      signInWithGoogle,
      resetPassword,
      logOut,
    }),
    [session, slot, loading, signUp, signIn, signInWithGoogle, resetPassword, logOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an <AuthProvider>");
  }
  return context;
}
