"use client";

import { useState } from "react";
import { ResetPasswordDialog } from "@/components/auth/reset-password-dialog";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * How you get in.
 *
 * Changing a password is done by emailing a link rather than with an old/new
 * pair of boxes on this page: the link proves the mailbox is still yours,
 * which is the thing a stolen session can't fake — and it's the same flow the
 * login page offers, so there's only one of them to get right.
 */
export function SecuritySettings() {
  const { user } = useAuth();
  const [resetting, setResetting] = useState(false);

  const email = user?.email ?? "";
  const hasPassword =
    user?.providerData.some((entry) => entry.providerId === "password") === true;
  const usesGoogle =
    user?.providerData.some((entry) => entry.providerId === "google.com") ===
    true;

  return (
    <>
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted"
          >
            <Icon name={usesGoogle && !hasPassword ? "globe" : "shield"} className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">
              {hasPassword
                ? "Email and password"
                : usesGoogle
                  ? "Signed in with Google"
                  : "Your sign-in"}
            </p>
            <p className="truncate text-sm text-muted">{email}</p>
          </div>
        </div>

        {hasPassword ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Password</p>
              <p className="text-sm text-muted">
                We&apos;ll email a link to {email} that lets you set a new one.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => setResetting(true)}
              className="shrink-0"
            >
              Send reset link
            </Button>
          </div>
        ) : (
          <div className="border-t border-border pt-4">
            <p className="text-sm text-muted">
              This account has no password — Google handles signing you in, so
              your password is changed in your{" "}
              <a
                href="https://myaccount.google.com/security"
                target="_blank"
                rel="noreferrer noopener"
                className="font-medium text-foreground underline underline-offset-4"
              >
                Google account
              </a>
              , not here.
            </p>
          </div>
        )}
      </div>

      {resetting ? (
        <ResetPasswordDialog
          open
          locked
          defaultEmail={email}
          onClose={() => setResetting(false)}
        />
      ) : null}
    </>
  );
}
