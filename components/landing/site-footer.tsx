import Link from "next/link";

/** The public site's footer, and where the app says who made it. */
export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-semibold tracking-tight text-foreground">
            Budget Tracker
          </p>
          <p className="text-sm text-muted">
            Created by{" "}
            <span className="font-medium text-foreground">Khanh Nguyen</span>
          </p>
        </div>

        {/* Log in and Dashboard both live in the header, where someone
            looking for them will already be. */}
        <nav aria-label="More" className="flex flex-col gap-2 sm:flex-row sm:gap-6">
          <Link
            href="/about"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            About us
          </Link>
          <Link
            href="/releases"
            className="text-sm text-muted transition-colors hover:text-foreground"
          >
            Release notes
          </Link>
        </nav>

        <p className="text-sm text-muted">
          © {new Date().getFullYear()} Budget Tracker
        </p>
      </div>
    </footer>
  );
}
