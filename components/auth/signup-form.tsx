"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";
import { AuthField } from "./auth-field";
import { SubmitButton } from "./submit-button";

export function SignupForm() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirmPassword") ?? "");

    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }

    setError(null);
    setPending(true);

    try {
      await signUp(
        String(form.get("name") ?? ""),
        String(form.get("email") ?? "").trim(),
        password,
      );
      router.replace("/dashboard");
    } catch (caught) {
      setError(authErrorMessage(caught));
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <AuthField
        id="name"
        label="Name"
        type="text"
        autoComplete="name"
        placeholder="Alex Doe"
        required
      />
      <AuthField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        required
      />
      <AuthField
        id="password"
        label="Password"
        type="password"
        autoComplete="new-password"
        placeholder="At least 6 characters"
        minLength={6}
        required
      />
      <AuthField
        id="confirmPassword"
        label="Confirm password"
        type="password"
        autoComplete="new-password"
        placeholder="Re-enter your password"
        minLength={6}
        required
      />

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <SubmitButton pending={pending}>Create account</SubmitButton>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Log in
        </Link>
      </p>
    </form>
  );
}
