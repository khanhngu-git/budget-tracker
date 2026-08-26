"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { EmailNotVerifiedError } from "./errors";

type AuthContextValue = {
  user: User | null;
  /** True until Firebase has restored (or ruled out) a persisted session. */
  loading: boolean;
  /** Creates the account, emails a verification link, and leaves them signed out. */
  signUp: (name: string, email: string, password: string) => Promise<void>;
  /** Throws {@link EmailNotVerifiedError} until the address has been confirmed. */
  signIn: (email: string, password: string) => Promise<void>;
  /** Google OAuth popup — used for both sign-up and sign-in. */
  signInWithGoogle: () => Promise<void>;
  logOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Firebase mutates the User object in place (e.g. on updateProfile), so it
  // can't drive re-renders on its own. Wrapping it gives every update a fresh
  // identity that React will notice.
  const [session, setSession] = useState<{ user: User | null }>({ user: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (nextUser) => {
      setSession({ user: nextUser });
      setLoading(false);
    });
  }, []);

  const signUp = useCallback(
    async (name: string, email: string, password: string) => {
      const { user: created } = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );

      const displayName = name.trim();
      if (displayName) await updateProfile(created, { displayName });

      await sendEmailVerification(created);

      // Firebase signs you in as a side effect of creating the account. That
      // would walk an unverified address straight into the app, so the session
      // is dropped again immediately: the link in the inbox is the only way in.
      await signOut(auth);
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const { user: signedIn } = await signInWithEmailAndPassword(
      auth,
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
      await signOut(auth);
      throw new EmailNotVerifiedError(signedIn.email ?? email);
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    // Always show the account chooser rather than silently reusing the last
    // Google session on a shared machine.
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user: session.user, loading, signUp, signIn, signInWithGoogle, logOut }),
    [session, loading, signUp, signIn, signInWithGoogle, logOut],
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
