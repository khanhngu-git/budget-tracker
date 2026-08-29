"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { signOut } from "firebase/auth";
import { Avatar } from "@/components/settings/avatar";
import { Button, ButtonLink } from "@/components/ui/button";
import { Icon, type IconName } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";
import {
  NO_ACCOUNTS,
  forgetAccount,
  emptySlot,
  knownAccounts,
  occupantOf,
  rememberAccount,
  subscribeKnownAccounts,
} from "@/lib/auth/known-accounts";
import { authFor, setActiveSlot } from "@/lib/firebase/client";
import type { KnownAccount } from "@/lib/auth/known-accounts";
import { useSettings } from "@/lib/settings/settings-context";

const ITEM =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-60";

function MenuLink({
  href,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  icon: IconName;
  children: ReactNode;
  onNavigate: () => void;
}) {
  return (
    <Link href={href} className={ITEM} role="menuitem" onClick={onNavigate}>
      <Icon name={icon} className="h-4 w-4 shrink-0 text-muted" />
      {children}
    </Link>
  );
}

function Divider() {
  return <hr className="my-1 border-t border-border" />;
}

/**
 * The second click, in the row the first one was in.
 *
 * Signing out is cheap to undo for the person who meant it and expensive for
 * the person who didn't — it ends a session, and on another account's row it
 * also takes that account off this menu. Neither belongs one stray click away
 * from a control that sits beside "Appearance".
 *
 * Asked in place rather than in a dialog: a modal over a dropdown puts the
 * question somewhere other than where it was raised, and the menu would have
 * to close underneath it to avoid two overlapping layers.
 */
function ConfirmRow({
  question,
  confirmLabel,
  pending,
  onConfirm,
  onCancel,
}: {
  question: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-surface-muted px-2.5 py-2">
      <p className="text-sm text-foreground">{question}</p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onConfirm} disabled={pending}>
          <Icon name="logOut" className="h-3.5 w-3.5" />
          {pending ? "Signing out…" : confirmLabel}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

/**
 * Who's signed in, and everything that is *about* being signed in — the same
 * in the public header and the dashboard's.
 *
 * One component rather than two so the avatar someone chose in Settings is the
 * avatar they see everywhere. That's why `SettingsProvider` sits at the root of
 * the app instead of only over /dashboard: the public pages need the same
 * preferences to render the same person.
 *
 * The signed-out pair is what shows while Firebase is still restoring the
 * session, so a header always paints something usable rather than a gap.
 */
export function UserMenu({ tone = "default" }: { tone?: "default" | "light" }) {
  const { user, slot, loading, logOut } = useAuth();
  const { preferences } = useSettings();
  const router = useRouter();
  const light = tone === "light";

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  /**
   * Which sign-out is waiting on a second click: this account, or one of the
   * others by uid. Cleared whenever the menu closes, so a question asked and
   * walked away from is never still sitting there on the way back.
   */
  const [confirming, setConfirming] = useState<
    { kind: "logout" } | { kind: "signOut"; uid: string } | null
  >(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Server-rendered markup has no `localStorage`, so it has no remembered
  // accounts — the third argument is what keeps hydration from disagreeing.
  const remembered = useSyncExternalStore(
    subscribeKnownAccounts,
    knownAccounts,
    () => NO_ACCOUNTS,
  );

  const displayName = preferences.displayName.trim();

  // Keeps the switcher's copy of *this* account current: rename yourself in
  // Settings and the other device's menu still says the old name, but this
  // one shouldn't.
  useEffect(() => {
    if (!user) return;
    rememberAccount({
      uid: user.uid,
      email: user.email ?? "",
      name: displayName || user.displayName || "",
      slot,
    });
  }, [user, displayName, slot]);

  /** Closes the menu, taking any half-asked question with it. */
  function dismiss() {
    setOpen(false);
    setConfirming(null);
  }

  // Click-away and Escape. A menu you can only close by re-clicking the thing
  // that opened it is a menu people leave open.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) dismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dismiss();
      triggerRef.current?.focus();
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (loading || !user) {
    return (
      <div className="flex shrink-0 items-center gap-1.5">
        <ButtonLink
          href="/login"
          variant={light ? "lightGhost" : "ghost"}
          size="sm"
        >
          Log in
        </ButtonLink>
        <ButtonLink
          href="/signup"
          variant={light ? "light" : "primary"}
          size="sm"
        >
          Get started
        </ButtonLink>
      </div>
    );
  }

  const name = displayName || user.email || "Account";
  const others = remembered.filter((entry) => entry.uid !== user.uid);

  /**
   * Being somebody else, without stopping being this one.
   *
   * Each account keeps its own persisted session in its own slot, so a switch
   * signs nobody out: it points the app at the other slot and the session
   * already sitting there comes straight back. The password only reappears if
   * that session has genuinely gone — logged out, or expired — which is what
   * the `authStateReady` check below is deciding.
   */
  async function switchTo(target: KnownAccount) {
    setSwitching(true);
    dismiss();
    try {
      // The recorded slot is a hint, never the answer. It is only a resumable
      // session if the account signed in over there is *this* account —
      // anything else (an emptied slot, a stale entry from a build that didn't
      // record slots, somebody else's session) means a password.
      const resumable =
        target.slot !== "" && (await occupantOf(target.slot)) === target.uid;

      if (resumable) {
        setActiveSlot(target.slot);
        router.push("/dashboard");
        return;
      }

      // Signing in afresh, and never on top of a live session — least of all
      // the one being switched away from.
      setActiveSlot(await emptySlot());
      router.push(
        target.email
          ? `/login?email=${encodeURIComponent(target.email)}`
          : "/login",
      );
    } finally {
      setSwitching(false);
    }
  }

  /**
   * A slot nobody is using, and the login form on top of it.
   *
   * The account being used right now stays signed in on its own slot
   * throughout — that is the entire difference between this and the sign-out
   * it used to be.
   */
  async function addAnother() {
    setSwitching(true);
    dismiss();
    try {
      setActiveSlot(await emptySlot());
      router.push("/login");
    } finally {
      setSwitching(false);
    }
  }

  /**
   * Ends another account's session and takes it off this menu.
   *
   * Both halves, deliberately: a slot still signed in with nothing naming it
   * is a session nobody can see or reach again.
   */
  async function signOutOther(entry: KnownAccount) {
    setSwitching(true);
    try {
      // An entry with no slot has no session to end — there is only the
      // shortcut, and that is what goes.
      if (entry.slot !== "") await signOut(authFor(entry.slot));
      forgetAccount(entry.uid);
      setConfirming(null);
    } finally {
      setSwitching(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative flex shrink-0 items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user.email ?? undefined}
        className={`flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-1.5 transition-colors ${
          light ? "hover:bg-white/10" : "hover:bg-surface-muted"
        }`}
      >
        <Avatar preferences={preferences} size="sm" />
        {/* The avatar alone carries it on a phone — the name is the first
            thing worth dropping when the row runs out of width. */}
        <span
          className={`hidden max-w-[12rem] truncate text-sm sm:inline ${
            light ? "text-zinc-200" : "text-muted"
          }`}
        >
          {name}
        </span>
        <Icon
          name="chevronDown"
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          } ${light ? "text-white/70" : "text-muted"}`}
        />
        <span className="sr-only">Account menu</span>
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-72 rounded-xl border border-border bg-surface p-1.5 text-foreground shadow-lg shadow-black/10"
        >
          <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
            <Avatar preferences={preferences} size="md" />
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-medium text-foreground">
                {name}
              </span>
              <span className="truncate text-xs text-muted">{user.email}</span>
            </div>
          </div>

          <Divider />

          <MenuLink
            href="/dashboard"
            icon="wallet"
            onNavigate={dismiss}
          >
            Overview
          </MenuLink>
          <MenuLink
            href="/dashboard/settings"
            icon="cog"
            onNavigate={dismiss}
          >
            Settings
          </MenuLink>
          <MenuLink
            href="/dashboard/settings#appearance"
            icon="palette"
            onNavigate={dismiss}
          >
            Appearance
          </MenuLink>
          <MenuLink
            href="/dashboard/settings#data-and-privacy"
            icon="shield"
            onNavigate={dismiss}
          >
            Data and privacy
          </MenuLink>

          <Divider />

          {others.length > 0 ? (
            <>
              <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-muted">
                Switch account
              </p>
              {others.map((entry) => {
                const named = entry.name || entry.email || "that account";

                if (
                  confirming?.kind === "signOut" &&
                  confirming.uid === entry.uid
                ) {
                  return (
                    <ConfirmRow
                      key={entry.uid}
                      question={`Sign ${named} out on this device? They'll be removed from this menu, and signing back in will need the password.`}
                      confirmLabel="Sign out"
                      pending={switching}
                      onConfirm={() => void signOutOther(entry)}
                      onCancel={() => setConfirming(null)}
                    />
                  );
                }

                return (
                  <div key={entry.uid} className="group relative flex items-center">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => switchTo(entry)}
                      disabled={switching}
                      className={`${ITEM} pr-9`}
                    >
                      <span
                        aria-hidden
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted"
                      >
                        <Icon name="user" className="h-3.5 w-3.5" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate">
                          {entry.name || entry.email || "Account"}
                        </span>
                        {entry.name && entry.email ? (
                          <span className="truncate text-xs text-muted">
                            {entry.email}
                          </span>
                        ) : null}
                      </span>
                    </button>
                    {/* A sign-out, and drawn as one. It used to be a close
                        cross, which reads as "dismiss this row" — the mildest
                        thing a control can mean, for an action that ends a
                        session. */}
                    <button
                      type="button"
                      onClick={() => setConfirming({ kind: "signOut", uid: entry.uid })}
                      disabled={switching}
                      aria-label={`Sign ${named} out on this device`}
                      title="Sign out on this device"
                      className="absolute right-1.5 flex h-7 w-7 items-center justify-center rounded-md text-muted opacity-0 transition-opacity hover:bg-surface-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
                    >
                      <Icon name="logOut" className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </>
          ) : null}

          <button
            type="button"
            role="menuitem"
            onClick={() => void addAnother()}
            disabled={switching}
            className={ITEM}
          >
            <Icon name="userPlus" className="h-4 w-4 shrink-0 text-muted" />
            {switching ? "Switching…" : "Add another account"}
          </button>

          <Divider />

          {confirming?.kind === "logout" ? (
            <ConfirmRow
              question={
                others.length > 0
                  ? `Log out of ${name}? Your other accounts on this device stay signed in.`
                  : `Log out of ${name}?`
              }
              confirmLabel="Log out"
              pending={switching}
              onConfirm={() => {
                dismiss();
                void logOut();
              }}
              onCancel={() => setConfirming(null)}
            />
          ) : (
            <button
              type="button"
              role="menuitem"
              onClick={() => setConfirming({ kind: "logout" })}
              disabled={switching}
              className={ITEM}
            >
              <Icon name="logOut" className="h-4 w-4 shrink-0 text-muted" />
              Log out
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
