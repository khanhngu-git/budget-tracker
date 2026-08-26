"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { useAuth } from "@/lib/auth/auth-context";
import { authErrorMessage } from "@/lib/auth/errors";

/**
 * Sends a password reset link.
 *
 * The confirmation is deliberately non-committal — "if that address has an
 * account" — because a form anyone can reach must not answer the question
 * "does this person bank here?". The same wording is used when the address is
 * the signed-in user's own, where it's merely redundant rather than wrong.
 */
export function ResetPasswordDialog({
  open,
  onClose,
  defaultEmail = "",
  /** Fixed when we already know whose password this is. */
  locked = false,
}: {
  open: boolean;
  onClose: () => void;
  defaultEmail?: string;
  locked?: boolean;
}) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(defaultEmail);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim();
    if (address === "") {
      setError("Enter the email address you signed up with.");
      return;
    }

    setError(null);
    setPending(true);
    try {
      await resetPassword(address);
      setSent(true);
    } catch (caught) {
      setError(authErrorMessage(caught) ?? "Couldn't send that. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={sent ? "Check your inbox" : "Reset your password"}
      description={
        sent
          ? undefined
          : "We'll email you a link that lets you set a new one. The link expires after an hour."
      }
    >
      {sent ? (
        <div className="flex flex-col gap-5">
          <p className="text-sm text-muted">
            If {email.trim()} has an account, a reset link is on its way. It can
            take a minute — and it does end up in spam sometimes.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Email" htmlFor="reset-email">
            <TextInput
              id="reset-email"
              type="email"
              autoComplete="email"
              autoFocus={!locked}
              placeholder="you@example.com"
              value={email}
              readOnly={locked}
              onChange={(event) => setEmail(event.target.value)}
              disabled={pending}
              className={locked ? "text-muted" : ""}
            />
          </Field>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
            >
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send reset link"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
