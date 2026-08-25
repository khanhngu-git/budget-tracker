"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

function Splash() {
  return (
    <div className="flex flex-1 items-center justify-center">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading…</p>
    </div>
  );
}

/** Renders `children` only for a signed-in user; otherwise sends them to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) return <Splash />;
  return <>{children}</>;
}

/** Keeps signed-in users off the login/signup pages. */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  if (loading || user) return <Splash />;
  return <>{children}</>;
}
