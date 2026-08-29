"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "@/components/nav/user-menu";

const LINKS = [
  { href: "/about", label: "About us" },
  { href: "/releases", label: "What's new" },
  { href: "/dashboard", label: "Dashboard" },
] as const;

type Tone = "default" | "light";

/**
 * The public site's header: the wordmark, the sections beside it, and whoever
 * is signed in.
 *
 * Shared by the home page and About rather than written twice, because the
 * two differ only in what sits behind them — the home page puts it on a
 * photograph, where the themed foreground token would come out dark on a dark
 * image, so every colour here has a `light` counterpart.
 */
export function SiteHeader({ tone = "default" }: { tone?: Tone }) {
  const light = tone === "light";

  return (
    <header className={light ? undefined : "border-b border-border bg-surface"}>
      <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">
          {/* The sections sit directly beside the wordmark, which is also the
              way back to the home page from anywhere. */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            <Logo tone={tone} />
            <nav aria-label="Site" className="hidden sm:block">
              <NavLinks tone={tone} />
            </nav>
          </div>

          <UserMenu tone={tone} />
        </div>

        {/* Below the wordmark on a phone, where one row can't hold both. */}
        <nav aria-label="Site" className="pb-3 sm:hidden">
          <NavLinks tone={tone} />
        </nav>
      </div>
    </header>
  );
}

function NavLinks({ tone }: { tone: Tone }) {
  const pathname = usePathname();
  const light = tone === "light";

  return (
    <ul className="flex items-center gap-1">
      {LINKS.map((link) => {
        const current = pathname === link.href;

        return (
          <li key={link.href}>
            <Link
              href={link.href}
              aria-current={current ? "page" : undefined}
              className={`inline-flex h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                light
                  ? current
                    ? "bg-white/15 text-white"
                    : "text-white/75 hover:text-white"
                  : current
                    ? "bg-surface-muted text-foreground"
                    : "text-muted hover:text-foreground"
              }`}
            >
              {link.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
