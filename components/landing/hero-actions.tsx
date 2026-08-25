"use client";

import { useAuth } from "@/lib/auth/auth-context";
import { ButtonLink } from "@/components/ui/button";

/** See HeaderActions — signed-out CTAs render by default, on purpose. */
export function HeroActions() {
  const { user, loading } = useAuth();

  if (!loading && user) {
    return (
      <ButtonLink href="/dashboard" variant="light">
        Go to dashboard
      </ButtonLink>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <ButtonLink href="/signup" variant="light">
        Create an account
      </ButtonLink>
      <ButtonLink href="/login" variant="lightOutline">
        Log in
      </ButtonLink>
    </div>
  );
}
