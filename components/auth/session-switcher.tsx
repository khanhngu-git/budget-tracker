"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icon";
import {
  knownAccounts,
  occupantOf,
  type KnownAccount,
} from "@/lib/auth/known-accounts";
import { activeSlot, setActiveSlot } from "@/lib/firebase/client";

/**
 * The other people already signed in on this browser.
 *
 * Logging out ends one session, not all of them — the whole point of slots is
 * that the rest keep going. Without this the login page would be a dead end
 * for them: the account menu is the switcher, and a signed-out header has no
 * account menu. So the switcher appears here instead, offering exactly the
 * accounts that can be resumed with a click and no password.
 *
 * Nothing is rendered when there are none, which is the ordinary case — a
 * heading over an empty list would raise a question the page can't answer.
 */
export function SessionSwitcher() {
  const [live, setLive] = useState<KnownAccount[]>([]);

  useEffect(() => {
    let cancelled = false;

    // Each slot's persisted session is restored asynchronously; asking before
    // it lands would report every account as signed out.
    async function findLive() {
      const current = activeSlot();
      const candidates = knownAccounts().filter(
        // "" is an account whose session we can't name, which is exactly the
        // set this list must not offer: there is nothing to continue.
        (entry) => entry.slot !== "" && entry.slot !== current,
      );

      const resolved = await Promise.all(
        candidates.map(async (entry) =>
          (await occupantOf(entry.slot)) === entry.uid ? entry : null,
        ),
      );

      if (!cancelled) {
        setLive(resolved.filter((entry): entry is KnownAccount => entry !== null));
      }
    }

    void findLive();
    return () => {
      cancelled = true;
    };
  }, []);

  if (live.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-foreground">Already signed in</p>
      <ul className="flex flex-col gap-1.5">
        {live.map((entry) => (
          <li key={entry.uid}>
            {/* No navigation of its own: making the slot live gives the page a
                verified user, and the redirect that already guards this page
                takes it from there. */}
            <button
              type="button"
              onClick={() => setActiveSlot(entry.slot)}
              className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-muted/50 hover:bg-surface-muted"
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted"
              >
                <Icon name="user" className="h-4 w-4" />
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-medium text-foreground">
                  Continue as {entry.name || entry.email}
                </span>
                {entry.name && entry.email ? (
                  <span className="truncate text-xs text-muted">
                    {entry.email}
                  </span>
                ) : null}
              </span>
              <Icon
                name="chevronRight"
                className="ml-auto h-4 w-4 shrink-0 text-muted"
              />
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Or sign in with another account below.
      </p>
    </div>
  );
}
