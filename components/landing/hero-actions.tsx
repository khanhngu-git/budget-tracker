"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { ButtonLink } from "@/components/ui/button";

/**
 * The page's single call to action, and the only "Go to dashboard" on it —
 * the header shows who's signed in rather than repeating this button.
 *
 * Like the header, the signed-out pair renders by default: it's what shows
 * while Firebase is still restoring the session, so the hero always paints
 * something you can act on.
 */
export function HeroActions({ tone = "light" }: { tone?: "light" | "default" }) {
  const { user, loading } = useAuth();
  const light = tone === "light";

  if (!loading && user) {
    return (
      <ButtonLink href="/dashboard" variant={light ? "light" : "primary"}>
        Go to dashboard
      </ButtonLink>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ButtonLink href="/signup" variant={light ? "light" : "primary"}>
        Create an account
      </ButtonLink>
      <ButtonLink href="/login" variant={light ? "lightOutline" : "outline"}>
        Log in
      </ButtonLink>
    </div>
  );
}
