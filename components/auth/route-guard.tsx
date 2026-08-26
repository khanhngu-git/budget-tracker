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
 * Renders `children` only for a signed-in, verified user; otherwise sends them
 * to /login. Holds a splash while the session resolves so protected content
 * never flashes.
 *
 * Sign-in already refuses an unverified address, so this is the second lock: a
 * session persisted from before that rule existed — or a Google account whose
 * address the provider never confirmed — gets sent back rather than being let
 * through on the strength of an old cookie.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const allowed = user !== null && user.emailVerified;

  useEffect(() => {
    if (!loading && !allowed) {
      router.replace("/login");
    }
  }, [loading, allowed, router]);

  if (loading || !allowed) return <Splash />;
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
    // An unverified user is deliberately left on the login page: they have a
    // session for a moment during sign-up, and bouncing them to a dashboard
    // they'd be thrown straight back out of would just flash.
    if (!loading && user?.emailVerified) {
      router.replace("/dashboard");
    }
  }, [loading, user, router]);

  return <>{children}</>;
}
