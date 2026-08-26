"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  deleteUser,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "firebase/auth";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";
import { deleteAllUserData, resetBudgetData } from "@/lib/budget/danger";

type Mode = "reset" | "delete";

const COPY: Record<
  Mode,
  { title: string; phrase: string; action: string; blurb: string; losses: string[] }
> = {
  reset: {
    title: "Start again from empty",
    phrase: "RESET",
    action: "Reset everything",
    blurb:
      "Every account, transaction and monthly plan is deleted. Your sign-in, your name and your settings stay exactly as they are, and you'll be asked for your opening balances again.",
    losses: [
      "Every account and its balance",
      "Every transaction, in every month",
      "Every budget goal, in every month",
    ],
  },
  delete: {
    title: "Delete your account",
    phrase: "DELETE MY ACCOUNT",
    action: "Delete my account",
    blurb:
      "Everything above, plus your profile and your sign-in itself. You will be signed out and this email will no longer have an account.",
    losses: [
      "Every account, transaction and budget goal",
      "Your name, picture and settings",
      "Your sign-in — this email will no longer have an account",
    ],
  },
};

/**
 * The two buttons there is no undo for.
 *
 * Nothing here is reversible and nothing is backed up, so the confirmation is
 * the entire safety mechanism — and it is deliberately slow. Three separate
 * acts are required and none of them can be done by momentum: read what goes,
 * tick that you understand, then type a phrase that cannot be produced by
 * clicking. Deleting the account asks for the password on top, because by then
 * the question is no longer "did you mean this" but "is this you".
 */
export function DangerZone() {
  const { user } = useAuth();
  const router = useRouter();
  const uid = user?.uid ?? null;

  const [mode, setMode] = useState<Mode | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = mode ? COPY[mode] : null;
  const needsPassword =
    mode === "delete" &&
    user?.providerData.some((entry) => entry.providerId === "password") === true;

  const armed =
    copy !== null &&
    acknowledged &&
    phrase.trim() === copy.phrase &&
    (!needsPassword || password !== "");

  function open(next: Mode) {
    setMode(next);
    setAcknowledged(false);
    setPhrase("");
    setPassword("");
    setError(null);
  }

  function close() {
    if (pending) return;
    setMode(null);
  }

  /**
   * Firebase refuses to delete a user whose sign-in is more than a few minutes
   * old, which is the right rule — a borrowed, unlocked laptop should not be
   * able to close someone's account.
   */
  async function reauthenticate() {
    if (!user) return;
    if (needsPassword) {
      await reauthenticateWithCredential(
        user,
        EmailAuthProvider.credential(user.email ?? "", password),
      );
      return;
    }
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await reauthenticateWithPopup(user, provider);
  }

  async function confirm() {
    if (!uid || !user || !mode || !armed) return;
    setPending(true);
    setError(null);

    try {
      if (mode === "reset") {
        await resetBudgetData(uid);
        setMode(null);
        // Back to the Overview, where the opening-balances prompt is waiting:
        // an empty Settings page is a dead end, and being asked "what's in
        // your accounts?" is the only sensible next step from here.
        router.push("/dashboard");
        return;
      }

      await reauthenticate();
      // Data first, credentials last: a failure at the final step leaves
      // someone who can still sign in and try again, rather than an orphaned
      // pile of documents nothing can reach.
      await deleteAllUserData(uid);
      await deleteUser(user);
    } catch (caught) {
      const code =
        typeof caught === "object" && caught !== null && "code" in caught
          ? String((caught as { code: unknown }).code)
          : "";

      setError(
        code === "auth/wrong-password" || code === "auth/invalid-credential"
          ? "That password doesn't match. Try again."
          : code === "auth/popup-closed-by-user"
            ? "That was cancelled — nothing has been deleted."
            : code === "auth/requires-recent-login"
              ? "For your security, sign out and back in, then try again."
              : "Couldn't finish that. Nothing may have been deleted — reload and check before trying again.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-negative/40 bg-surface p-6">
        <div className="flex items-start gap-3">
          <span aria-hidden className="mt-0.5 text-negative">
            <Icon name="alert" className="h-5 w-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
              There is no undo for either of these
            </h3>
            <p className="text-sm text-muted">
              Nothing here is recoverable and nothing is backed up. Both ask you
              to confirm twice before anything happens.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Reset my data
            </p>
            <p className="text-sm text-muted">
              Delete every account, transaction and plan. Keep the sign-in.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => open("reset")}
            disabled={!uid}
            className="shrink-0"
          >
            Reset everything
          </Button>
        </div>

        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">
              Delete my account
            </p>
            <p className="text-sm text-muted">
              Everything above, plus your profile and your sign-in.
            </p>
          </div>
          <button
            type="button"
            onClick={() => open("delete")}
            disabled={!uid}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-lg bg-negative px-5 text-[0.9375rem] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete my account
          </button>
        </div>
      </div>

      {copy ? (
        <Dialog
          open
          onClose={close}
          title={copy.title}
          description={copy.blurb}
        >
          <div className="flex flex-col gap-4">
            <ul className="flex flex-col gap-2 rounded-xl border border-negative/40 bg-negative/5 p-4">
              {copy.losses.map((loss) => (
                <li
                  key={loss}
                  className="flex items-start gap-2 text-sm text-foreground"
                >
                  <span aria-hidden className="mt-0.5 shrink-0 text-negative">
                    <Icon name="trash" className="h-4 w-4" />
                  </span>
                  {loss}
                </li>
              ))}
            </ul>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(event) => setAcknowledged(event.target.checked)}
                disabled={pending}
                className="mt-0.5 h-4 w-4 accent-[var(--negative)]"
              />
              <span className="text-sm text-foreground">
                I understand this is permanent and cannot be undone.
              </span>
            </label>

            <Field
              label={`Type ${copy.phrase} to confirm`}
              htmlFor="danger-phrase"
              hint="Exactly as written, in capitals."
            >
              <TextInput
                id="danger-phrase"
                value={phrase}
                autoComplete="off"
                placeholder={copy.phrase}
                onChange={(event) => setPhrase(event.target.value)}
                disabled={pending || !acknowledged}
              />
            </Field>

            {needsPassword ? (
              <Field
                label="Your password"
                htmlFor="danger-password"
                hint="Asked for because deleting an account has to be you."
              >
                <TextInput
                  id="danger-password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={pending || !acknowledged}
                />
              </Field>
            ) : mode === "delete" ? (
              <p className="text-sm text-muted">
                You&apos;ll be asked to sign in with Google again before this
                goes ahead.
              </p>
            ) : null}

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
                onClick={close}
                disabled={pending}
              >
                Keep everything
              </Button>
              <button
                type="button"
                onClick={confirm}
                disabled={!armed || pending}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-negative px-5 text-[0.9375rem] font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pending ? "Deleting…" : copy.action}
              </button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
