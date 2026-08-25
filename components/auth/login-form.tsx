"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";
import { AuthField } from "./auth-field";
import { SubmitButton } from "./submit-button";

export function LoginForm() {
  const { signIn } = useAuth();
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

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
        autoComplete="current-password"
        placeholder="••••••••"
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

      <SubmitButton pending={pending}>Log in</SubmitButton>

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        Don&apos;t have an account?{" "}
        <Link
          href="/signup"
          className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-50"
        >
          Sign up
        </Link>
      </p>
    </form>
  );
}
