import Image from "next/image";
import { Logo } from "@/components/brand/logo";
import { HeaderActions } from "@/components/landing/header-actions";
import { HeroActions } from "@/components/landing/hero-actions";

const POINTS = [
  {
    title: "Every expense, one place",
    body: "Log what you spend in seconds and see where the month actually went.",
  },
  {
    title: "Budgets that hold",
    body: "Set a limit per category and watch what's left, not what's gone.",
  },
  {
    title: "Yours alone",
    body: "Your account is private and secured by Firebase Authentication.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Photo band: header + hero share one backdrop. */}
      <div className="relative isolate">
        <Image
          src="/bg-landing.jpeg"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-center"
        />
        {/* The photo is bright and busy, so the scrim is heavy on the left
            where the copy sits, and lifts toward the right. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/92 via-zinc-950/80 to-zinc-950/55"
        />
        {/* Fades the band into the page background below it. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-background"
        />

        <header>
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between px-6">
            <Logo tone="light" />
            <HeaderActions />
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-6 pb-32 pt-20 sm:pb-40 sm:pt-28">
          <p className="text-sm font-medium text-emerald-300">
            Personal budgeting, simplified
          </p>
          <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Know where your money goes.
          </h1>
          <p className="max-w-lg text-pretty text-lg leading-relaxed text-zinc-200">
            A quiet, no-nonsense budget tracker. Add your expenses, set your
            limits, and get a clear picture of the month — nothing more.
          </p>
          <HeroActions />
        </section>
      </div>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6">
        <section className="grid gap-10 py-16 sm:grid-cols-3 sm:gap-8">
          {POINTS.map((point) => (
            <div key={point.title} className="flex flex-col gap-2">
              <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                {point.title}
              </h2>
              <p className="text-sm leading-relaxed text-muted">{point.body}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <p className="text-sm text-muted">
            © {new Date().getFullYear()} Budget Tracker
          </p>
        </div>
      </footer>
    </div>
  );
}
