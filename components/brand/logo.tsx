import Link from "next/link";

/** Wordmark with a small bar-chart mark — used in the header and auth pages. */
export function Logo({
  href = "/",
  tone = "default",
}: {
  href?: string;
  /** "light" for use on the hero photo, where foreground would go dark. */
  tone?: "default" | "light";
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 text-[0.9375rem] font-semibold tracking-tight ${
        tone === "light" ? "text-white" : "text-foreground"
      }`}
    >
      <span
        aria-hidden
        className="flex h-6 w-6 items-end justify-center gap-[2px] rounded-md bg-accent p-1.5"
      >
        <span className="h-1.5 w-[3px] rounded-sm bg-accent-foreground/70" />
        <span className="h-3 w-[3px] rounded-sm bg-accent-foreground" />
      </span>
      Budget Tracker
    </Link>
  );
}
