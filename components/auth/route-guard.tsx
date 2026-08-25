"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";

function Splash() {
  return (
    <div className="flex flex-1 items-center justify-center bg-surface-muted">
      <p className="text-sm text-muted">Loading…</p>
    </div>
  );
}

/**
 * Renders `children` only for a signed-in user; otherwise sends them to /login.
 * Holds a splash while the session resolves so protected content never flashes.
 */
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

/**
 * Bounces already-signed-in users away from the login/signup pages.
 *
 * These pages are public, so the form renders immediately rather than waiting
 * on the session — a stalled auth init (private browsing, blocked storage)
 * must never leave someone staring at a spinner they can't get past.
 */
export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  return <>{children}</>;
}
