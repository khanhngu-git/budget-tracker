"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { AuthField, FormError } from "./auth-field";
import { GoogleButton, OrDivider } from "./google-button";

export function SignupForm() {
  const { signUp, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // The address we've just emailed. Set means the account exists and the only
  // thing left to do is open the link — so the form is replaced rather than
  // left on screen inviting a second submission.
  const [sentTo, setSentTo] = useState<string | null>(null);

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

    const email = String(form.get("email") ?? "").trim();

    try {
      await signUp(String(form.get("name") ?? ""), email, password);
      setSentTo(email);
      setPending(false);
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

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <span
          aria-hidden
          className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-muted text-muted"
        >
          <Icon name="mail" className="h-6 w-6" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Check your inbox
          </h2>
          <p className="text-sm text-muted">
            We&apos;ve sent a verification link to{" "}
            <span className="font-medium text-foreground">{sentTo}</span>. Open
            it to confirm the address, then log in.
          </p>
        </div>
        <Link href="/login" className={`${buttonClasses("primary", "md")} w-full`}>
          Go to log in
        </Link>
        <p className="text-sm text-muted">
          Nothing there? Check spam — or try logging in and we&apos;ll send
          another.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <GoogleButton
        onClick={handleGoogle}
        disabled={pending}
        label="Sign up with Google"
      />

      <OrDivider />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <AuthField
          id="name"
          label="Name"
          type="text"
          autoComplete="name"
          placeholder="Alex Doe"
          disabled={pending}
          required
        />
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
          autoComplete="new-password"
          placeholder="At least 6 characters"
          minLength={6}
          disabled={pending}
          required
        />
        <AuthField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter your password"
          minLength={6}
          disabled={pending}
          required
        />

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-foreground underline underline-offset-4"
        >
          Log in
        </Link>
      </p>
    </div>
  );
}
