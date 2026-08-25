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
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client";

type AuthContextValue = {
  user: User | null;
  /** True until Firebase has restored (or ruled out) a persisted session. */
  loading: boolean;
  signUp: (name: string, email: string, password: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
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
      if (displayName) {
        await updateProfile(created, { displayName });
        // updateProfile doesn't re-fire onAuthStateChanged, so publish the
        // updated user ourselves.
        setSession({ user: auth.currentUser });
      }
    },
    [],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const logOut = useCallback(async () => {
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ user: session.user, loading, signUp, signIn, logOut }),
    [session, loading, signUp, signIn, logOut],
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
