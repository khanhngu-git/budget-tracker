import Image from "next/image";
import type { Metadata } from "next";
import { HeroActions } from "@/components/landing/hero-actions";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { Icon, type IconName } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "About us · Budget Tracker",
  description:
    "Budget Tracker is a personal budgeting app created by Khanh Nguyen.",
};

const PRINCIPLES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "scales",
    title: "Accurate to the cent",
    body: "Amounts are stored as whole cents and only converted when displayed, so no figure can drift through rounding.",
  },
  {
    icon: "shield",
    title: "Consistent records",
    body: "An entry and the balance it affects are saved together, so the ledger and your totals can never disagree.",
  },
  {
    icon: "repeat",
    title: "Reliable history",
    body: "Past months are calculated from your current totals, so earlier figures stay correct however much you record later.",
  },
  {
    icon: "key",
    title: "Private by design",
    body: "Your data goes straight to Firestore, where security rules limit access to your own account.",
  },
];

export default function About() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Photo band: header + intro share one backdrop, as on the home page. */}
      <div className="relative isolate">
        {/* A portrait photograph in a wide, short band — the crop is doing
            real work here. Held above centre so the band keeps the clock
            tower and the skyline rather than a slice of empty road. */}
        <Image
          src="/melbourne.jpg"
          alt=""
          aria-hidden
          fill
          priority
          sizes="100vw"
          className="-z-10 object-cover object-[center_38%]"
        />
        {/* Brighter photograph than the home page's — a pale sky behind white
            text — so the scrim is heavier throughout, not just on the left. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/94 via-zinc-950/86 to-zinc-950/65"
        />
        {/* Fades into the section below, which is `surface` rather than
            `background` — the two differ in dark mode. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-surface"
        />

        <SiteHeader tone="light" />

        <section className="mx-auto w-full max-w-5xl px-4 pb-24 pt-10 sm:px-6 sm:pb-28 sm:pt-14">
          <p className="text-sm font-medium text-emerald-300">About us</p>
          <h1 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
            Budget Tracker
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-zinc-200">
            A personal budgeting app for keeping one accurate record of your
            money — every account, every transaction, and a plan for each
            month.
          </p>
        </section>
      </div>

      <main className="flex-1">
        <section className="bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 pb-16 pt-4 sm:px-6 sm:pb-20 sm:pt-6">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              How it is built
            </h2>
            <div className="mt-9 grid gap-x-8 gap-y-9 sm:grid-cols-2">
              {PRINCIPLES.map((principle) => (
                <div key={principle.title} className="flex items-start gap-3.5">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
                  >
                    <Icon name={principle.icon} className="h-5 w-5" />
                  </span>
                  <div className="flex min-w-0 flex-col gap-1">
                    <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                      {principle.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {principle.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The photograph returns here, cropped to its lower half — the band
            at the top of the page holds the upper half, so the two read as one
            image continuing down behind the panel between them. */}
        <section className="relative isolate">
          <Image
            src="/melbourne.jpg"
            alt=""
            aria-hidden
            fill
            sizes="100vw"
            className="-z-10 object-cover object-bottom"
          />
          <div
            aria-hidden
            className="absolute inset-0 -z-10 bg-gradient-to-r from-zinc-950/94 via-zinc-950/88 to-zinc-950/70"
          />
          {/* Fades up from the panel above and back down into the one below,
              so the photo arrives and leaves rather than starting on a seam. */}
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-surface to-transparent"
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 -z-10 h-24 bg-gradient-to-b from-transparent to-surface"
          />

          <div className="mx-auto w-full max-w-5xl px-4 py-20 sm:px-6 sm:py-24">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Who made it
            </h2>

            <div className="mt-8 flex max-w-3xl flex-col gap-5 rounded-2xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm sm:flex-row sm:items-start sm:gap-6 sm:p-8">
              <span
                aria-hidden
                className="flex h-16 w-16 shrink-0 select-none items-center justify-center rounded-full bg-white/15 text-2xl font-semibold text-white"
              >
                K
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <div>
                  <p className="text-lg font-semibold tracking-tight text-white">
                    Khanh Nguyen
                  </p>
                  <p className="text-sm text-zinc-300">
                    Creator and developer of Budget Tracker
                  </p>
                </div>
                <p className="text-pretty text-sm leading-relaxed text-zinc-200">
                  Budget Tracker is designed, built and maintained by Khanh
                  Nguyen. It began as a personal tool for keeping an accurate
                  running total across several accounts, and grew into a full
                  ledger with monthly budgets and reporting.
                </p>
                <p className="text-pretty text-sm leading-relaxed text-zinc-200">
                  It is built with Next.js and React, using Firebase
                  Authentication for accounts and Cloud Firestore for storage.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-surface">
          <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-5 px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Get started
            </h2>
            <p className="max-w-xl text-sm leading-relaxed text-muted">
              Create an account, add what you hold, and record as you go.
            </p>
            <HeroActions tone="default" />
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
