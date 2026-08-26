"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useAuth } from "@/lib/auth/auth-context";

/** Long enough to read as a deliberate opening rather than a stutter. */
const MIN_MS = 900;
/** Never hold the page hostage to an auth call that has stalled. */
const MAX_MS = 2500;
/** Matches the .splash-leaving animation. */
const FADE_MS = 450;
const SEEN_KEY = "budget-tracker:splash-seen";

/** Only ever runs in the browser; `useLayoutEffect` would warn during SSR. */
const useBeforePaint =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Private browsing and blocked site data throw rather than return null, so
 * both reads and writes are best-effort: the cost of failing is that the
 * splash plays again, which is the behaviour we started from anyway.
 */
function seen(): boolean {
  try {
    return sessionStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

function markSeen() {
  try {
    sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Ignored deliberately — see above.
  }
}

/**
 * The opening curtain.
 *
 * It covers the home page until Firebase has said whether anyone is signed in,
 * which is the moment the header stops being a guess — so the page is never
 * seen rearranging itself from "Get started" into somebody's name.
 *
 * Once per tab, not once per visit: coming back from About doesn't replay the
 * whole thing.
 */
export function SiteSplash() {
  const { loading } = useAuth();
  const [gone, setGone] = useState(false);
  const [held, setHeld] = useState(true);
  const [expired, setExpired] = useState(false);

  // Rendered by default, so the very first paint — the server's HTML, before
  // any of this has run — is already covered. A tab that has seen it drops it
  // here, before the browser paints, rather than flashing it again.
  useBeforePaint(() => {
    // Before paint, not after: a frame later would be a visible flash.
    if (seen()) setGone(true);
  }, []);

  useEffect(() => {
    const min = setTimeout(() => setHeld(false), MIN_MS);
    const max = setTimeout(() => setExpired(true), MAX_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);

  // Derived rather than stored: it's a reading of the three things above, and
  // a fourth piece of state would only be able to disagree with them.
  const leaving = !held && (!loading || expired);

  useEffect(() => {
    if (!leaving) return;
    const id = setTimeout(() => {
      setGone(true);
      markSeen();
    }, FADE_MS);
    return () => clearTimeout(id);
  }, [leaving]);

  if (gone) return null;

  return (
    <div
      role="status"
      aria-label="Loading Budget Tracker"
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background ${
        leaving ? "splash-leaving" : ""
      }`}
    >
      <span aria-hidden className="flex items-end gap-1.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="splash-bar w-3 rounded-sm bg-accent"
            style={{ animationDelay: `${index * 160}ms` }}
          />
        ))}
      </span>

      <p className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
        Budget Tracker
      </p>

      <span
        aria-hidden
        className="h-0.5 w-40 overflow-hidden rounded-full bg-border"
      >
        <span className="splash-track block h-full w-1/3 rounded-full bg-accent" />
      </span>
    </div>
  );
}
