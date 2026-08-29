import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Log in · Budget Tracker",
};

export default function LoginPage() {
  return (
    <>
      <header className="mb-6 flex flex-col gap-1.5">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Welcome back
        </h1>
        <p className="text-sm text-muted">Log in to pick up where you left off.</p>
      </header>
      {/* The form reads `?email=` to pre-fill the address, which opts its
          subtree out of static prerendering — so only the form suspends, not
          the heading above it. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </>
  );
}
