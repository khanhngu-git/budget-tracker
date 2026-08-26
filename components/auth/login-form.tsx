"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";
import { Button } from "@/components/ui/button";
import { AuthField, FormError } from "./auth-field";
import { ResetPasswordDialog } from "./reset-password-dialog";
import { GoogleButton, OrDivider } from "./google-button";

export function LoginForm() {
  const { signIn, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  // Opened with whatever is already typed in the email box, so someone who has
  // just failed to log in doesn't have to type their address a second time.
  const [resettingFor, setResettingFor] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function openReset() {
    const typed = formRef.current
      ? String(new FormData(formRef.current).get("email") ?? "").trim()
      : "";
    setResettingFor(typed);
  }

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

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
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

        <div className="-mt-1 flex justify-end">
          <button
            type="button"
            onClick={openReset}
            disabled={pending}
            className="text-sm font-medium text-muted underline underline-offset-4 transition-colors hover:text-foreground disabled:opacity-60"
          >
            Forgot your password?
          </button>
        </div>

        <FormError message={error} />

        <Button type="submit" disabled={pending} className="mt-1 w-full">
          {pending ? "Signing in…" : "Log in"}
        </Button>
      </form>

      {resettingFor !== null ? (
        <ResetPasswordDialog
          // Remounts per attempt so the field opens on what's typed now.
          key={resettingFor}
          open
          defaultEmail={resettingFor}
          onClose={() => setResettingFor(null)}
        />
      ) : null}

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
