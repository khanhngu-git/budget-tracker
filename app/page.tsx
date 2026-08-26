import Image from "next/image";
import { HeroActions } from "@/components/landing/hero-actions";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteSplash } from "@/components/landing/site-splash";
import { Icon, type IconName } from "@/components/ui/icon";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "bank",
    title: "Accounts",
    body: "Current accounts, savings, investments and debt in one total.",
  },
  {
    icon: "swap",
    title: "Transactions",
    body: "Income, expenses and transfers. Balances update as you record them.",
  },
  {
    icon: "repeat",
    title: "Monthly view",
    body: "Every month keeps its own figures. Past months stay accurate.",
  },
  {
    icon: "target",
    title: "Budgets",
    body: "Set a target for savings, investments and each spending category.",
  },
  {
    icon: "tag",
    title: "Categories",
    body: "Around forty categories, searchable by name or icon.",
  },
  {
    icon: "shield",
    title: "Security",
    body: "Private to your account, secured by Firebase Authentication.",
  },
];

const STEPS: { icon: IconName; title: string; body: string }[] = [
  {
    icon: "plus",
    title: "Add your accounts",
    body: "Enter what you hold and what you owe.",
  },
  {
    icon: "receipt",
    title: "Record as you go",
    body: "Log income and expenses in a few seconds.",
  },
  {
    icon: "trendUp",
    title: "Review the month",
    body: "See your spending by category and how you are tracking.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <SiteSplash />

      {/* Photo band: header + hero share one backdrop. */}
      <div className="relative isolate">
        <Image
          src="/accountant.jpg"
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

        <SiteHeader tone="light" />

        <section className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 px-4 pb-32 pt-20 sm:px-6 sm:pb-40 sm:pt-28">
          <p className="text-sm font-medium text-emerald-300">
            Personal budgeting
          </p>
          <h1 className="max-w-2xl text-balance text-4xl font-semibold leading-[1.1] tracking-tight text-white sm:text-5xl">
            Know where your money goes.
          </h1>
          <p className="max-w-md text-pretty text-lg leading-relaxed text-zinc-200">
            Track every account, record what you spend, and set a budget for
            each month.
          </p>
          <HeroActions />
        </section>
      </div>

      <main className="flex-1">
        <section className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="grid gap-x-8 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="flex items-start gap-3.5">
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-accent"
                >
                  <Icon name={feature.icon} className="h-5 w-5" />
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                    {feature.title}
                  </h2>
                  <p className="text-sm leading-relaxed text-muted">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-border bg-surface">
          <div className="mx-auto w-full max-w-5xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              How it works
            </h2>
            <ol className="mt-9 grid gap-8 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex flex-col gap-3">
                  <span
                    aria-hidden
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-accent-foreground"
                  >
                    <Icon name={step.icon} className="h-5 w-5" />
                  </span>
                  <div className="flex flex-col gap-1">
                    <h3 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
                      <span className="text-muted tabular-nums">
                        {index + 1}.
                      </span>{" "}
                      {step.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
