"use client";

import Link from "next/link";
import { Avatar } from "@/components/settings/avatar";
import { ButtonLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useAuth } from "@/lib/auth/auth-context";
import { useSettings } from "@/lib/settings/settings-context";

/**
 * Who's signed in, and the way out — the same in the public header and the
 * dashboard's.
 *
 * One component rather than two so the avatar someone chose in Settings is
 * the avatar they see everywhere. That's why `SettingsProvider` sits at the
 * root of the app instead of only over /dashboard: the public pages need the
 * same preferences to render the same person.
 *
 * The signed-out pair is what shows while Firebase is still restoring the
 * session, so a header always paints something usable rather than a gap.
 */
export function UserMenu({ tone = "default" }: { tone?: "default" | "light" }) {
  const { user, loading, logOut } = useAuth();
  const { preferences } = useSettings();
  const light = tone === "light";

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

  const name = preferences.displayName.trim() || user.email || "Account";

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {/* Links to Settings rather than opening a menu: the avatar is the only
          thing on the page that is *about* the user, so the one page that is
          too. */}
      <Link
        href="/dashboard/settings"
        title={user.email ?? undefined}
        className={`flex min-w-0 items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors ${
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
      </Link>

      <button
        type="button"
        onClick={logOut}
        aria-label="Log out"
        title="Log out"
        className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
          light
            ? "text-white/70 hover:bg-white/10 hover:text-white"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        <Icon name="logOut" className="h-[1.125rem] w-[1.125rem]" />
      </button>
    </div>
  );
}
