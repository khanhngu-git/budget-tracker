"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { ButtonLink } from "@/components/ui/button";

/**
 * Swaps the header CTAs based on auth state. The signed-out pair is the
 * default so the landing page always paints a usable call to action, even
 * before Firebase has restored the session (or if its request is slow).
 */
export function HeaderActions() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <ButtonLink href="/dashboard" variant="light" size="sm">
        Go to dashboard
      </ButtonLink>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <ButtonLink href="/login" variant="lightGhost" size="sm">
        Log in
      </ButtonLink>
      <ButtonLink href="/signup" variant="light" size="sm">
        Get started
      </ButtonLink>
    </div>
  );
}
