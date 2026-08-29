"use client";

import { useState } from "react";
import { Section } from "@/components/dashboard/section";
import { Icon, type IconName } from "@/components/ui/icon";
import { CompoundCalculator } from "@/components/tools/compound-calculator";
import { InflationCalculator } from "@/components/tools/inflation-calculator";
import { LoanCalculator } from "@/components/tools/loan-calculator";
import { PayoffCalculator } from "@/components/tools/payoff-calculator";
import { SavingsCalculator } from "@/components/tools/savings-calculator";

/**
 * Every tool is a question someone arrives already having.
 *
 * So the chooser is written as those questions rather than as the names of the
 * formulas behind them: nobody opens a budgeting app wanting "amortisation",
 * they want to know what the card costs them. The name is the shortest handle
 * for the question, and the line under it is the question itself.
 */
const TOOLS: {
  id: string;
  label: string;
  blurb: string;
  icon: IconName;
  render: () => React.ReactNode;
}[] = [
  {
    id: "compound",
    label: "Compound interest",
    blurb: "What will this grow to?",
    icon: "trendUp",
    render: () => <CompoundCalculator />,
  },
  {
    id: "savings",
    label: "Savings goal",
    blurb: "How long until I get there?",
    icon: "vault",
    render: () => <SavingsCalculator />,
  },
  {
    id: "payoff",
    label: "Debt payoff",
    blurb: "When is the card clear?",
    icon: "debt",
    render: () => <PayoffCalculator />,
  },
  {
    id: "loan",
    label: "Loan repayments",
    blurb: "What would it cost to borrow?",
    icon: "bank",
    render: () => <LoanCalculator />,
  },
  {
    id: "inflation",
    label: "Buying power",
    blurb: "What will money be worth?",
    icon: "trendDown",
    render: () => <InflationCalculator />,
  },
];

/**
 * Calculators, one at a time.
 *
 * They sit on their own tab rather than under Budget or Statistics because
 * none of them is about a month: they answer questions about years, and
 * putting them behind the month switcher would imply the answer changes when
 * you page back to July. Nothing here is saved — they're scratch paper, and
 * being scratch paper is why they can be typed in freely.
 *
 * One on screen at a time, because a page of five is five sets of fields to
 * scroll past to reach the one being used, and no way to tell at a glance
 * which figures belong to which question.
 */
export default function ToolsPage() {
  const [chosen, setChosen] = useState(TOOLS[0].id);
  const tool = TOOLS.find((entry) => entry.id === chosen) ?? TOOLS[0];

  return (
    <>
      <Section
        title="Calculators"
        subtitle="Work out what a plan is worth before you commit to it. Nothing here touches your accounts."
      >
        <ul
          role="radiogroup"
          aria-label="Calculator"
          className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
        >
          {TOOLS.map((entry) => {
            const current = entry.id === tool.id;
            return (
              <li key={entry.id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={current}
                  onClick={() => setChosen(entry.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                    current
                      ? "border-accent bg-accent/10"
                      : "border-border hover:border-muted/50 hover:bg-surface-muted"
                  }`}
                >
                  <span
                    aria-hidden
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      current
                        ? "bg-accent text-accent-foreground"
                        : "bg-surface-muted text-muted"
                    }`}
                  >
                    <Icon name={entry.icon} className="h-4.5 w-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {entry.label}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {entry.blurb}
                    </span>
                  </span>
                  {current ? (
                    <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {/* Keyed, so switching tools mounts a fresh form rather than leaving the
          previous one's figures sitting in fields that now mean something
          else. */}
      <Section divided title={tool.label}>
        <div key={tool.id}>{tool.render()}</div>
      </Section>
    </>
  );
}
