import type { Metadata } from "next";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { HeroActions } from "@/components/landing/hero-actions";
import {
  CHANGE_LABELS,
  LATEST,
  RELEASES,
  type ChangeKind,
} from "@/lib/site/releases";

export const metadata: Metadata = {
  title: "Release notes · Budget Tracker",
  description:
    "Everything that has been added to Budget Tracker, and the date each one landed.",
};

/**
 * The tags carry their meaning in the word, not the colour.
 *
 * "New" takes the accent because it is what most readers are here for and
 * there is a lot of it; the other two stay in ink so a page of thirty entries
 * doesn't read as a colour chart. Nothing is distinguished by colour alone —
 * every tag says what it is.
 */
const TAG_STYLES: Record<ChangeKind, string> = {
  new: "border-accent/30 bg-accent/10 text-accent",
  improved: "border-border bg-surface-muted text-muted",
  fixed: "border-border bg-surface-muted text-muted",
};

/**
 * What has shipped, newest first.
 *
 * Laid out as a dated timeline rather than a flat list, because the date is
 * half of what the page is for — the reader is either catching up since they
 * last looked, or checking when something arrived. On a wide screen the date
 * sits in its own column and sticks while its entries scroll past, so it is
 * always clear which day is being read.
 */
export default function ReleaseNotes() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteHeader />

      <main className="flex-1 bg-surface">
        <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
          <header className="flex flex-col gap-3">
            <p className="text-sm font-medium text-accent">Release notes</p>
            <h1 className="text-balance text-3xl font-semibold leading-tight tracking-tight text-foreground sm:text-4xl">
              What&apos;s new in Budget Tracker
            </h1>
            <p className="max-w-2xl text-pretty text-base leading-relaxed text-muted">
              Everything that has been added since the first version, with the
              date it landed. Most recent first — the latest is{" "}
              <time dateTime={LATEST.date} className="font-medium text-foreground">
                {LATEST.label}
              </time>
              .
            </p>
          </header>

          <ol className="mt-12 flex flex-col gap-12 sm:gap-14">
            {RELEASES.map((release) => (
              <li
                key={release.date}
                className="flex flex-col gap-5 border-t border-border pt-8 sm:flex-row sm:gap-10"
              >
                {/* Sticky on a wide screen, so the day stays named however far
                    its own list runs. */}
                <div className="flex shrink-0 flex-col gap-1.5 sm:sticky sm:top-6 sm:h-fit sm:w-52">
                  <time
                    dateTime={release.date}
                    className="text-[0.9375rem] font-semibold tracking-tight text-foreground"
                  >
                    {release.label}
                  </time>
                  <p className="text-sm leading-relaxed text-muted">
                    {release.summary}
                  </p>
                </div>

                <ul className="flex min-w-0 flex-1 flex-col gap-5">
                  {release.changes.map((change) => (
                    <li key={change.title} className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[0.6875rem] font-medium uppercase tracking-wide ${
                            TAG_STYLES[change.kind]
                          }`}
                        >
                          {CHANGE_LABELS[change.kind]}
                        </span>
                        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                          {change.title}
                        </h2>
                      </div>
                      <p className="text-pretty text-sm leading-relaxed text-muted">
                        {change.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <section className="mt-16 flex flex-col items-start gap-5 border-t border-border pt-10">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Start using it
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              Create an account, add what you hold, and record as you go.
            </p>
            <HeroActions tone="default" />
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
