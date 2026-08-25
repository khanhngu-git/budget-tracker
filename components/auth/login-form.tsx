"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { AuthField, FormError } from "./auth-field";
import { GoogleButton, OrDivider } from "./google-button";

export function LoginForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError(null);
    setPending(true);

    try {
      await signIn(
        String(form.get("email") ?? "").trim(),
        String(form.get("password") ?? ""),
      );
      router.replace("/dashboard");
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setPending(true);
    try {
      await signInWithGoogle();
      router.replace("/dashboard");
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton
        onClick={handleGoogle}
        disabled={pending}
        label="Continue with Google"
      />

      <OrDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          disabled={pending}
          required
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          disabled={pending}
          required
        />

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Signing in…" : "Log in"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Sign up
        </Link>
      </p>
    </div>
  );
}
