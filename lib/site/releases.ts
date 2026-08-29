/**
 * What has been released, and when.
 *
 * Dated from the history rather than from memory: each release below is a
 * day's work as it actually landed, so the page can be checked against the
 * repository instead of being taken on trust.
 *
 * Written for the person using the app, not the person who built it. A commit
 * message names the code that changed; an entry here names the thing you can
 * now do, which is the only part a reader of this page cares about. Dates are
 * spelled out as strings rather than formatted at render, so the page reads
 * the same on every machine and in every locale.
 */

export type ChangeKind = "new" | "improved" | "fixed";

export const CHANGE_LABELS: Record<ChangeKind, string> = {
  new: "New",
  improved: "Improved",
  fixed: "Fixed",
};

export type Change = {
  kind: ChangeKind;
  title: string;
  body: string;
};

export type Release = {
  /** ISO, for the <time> element. */
  date: string;
  /** The same day, written out — never formatted at render. */
  label: string;
  /** What the day amounted to, in one line. */
  summary: string;
  changes: Change[];
};

export const RELEASES: Release[] = [
  {
    date: "2026-08-30",
    label: "30 August 2026",
    summary: "Several accounts on one browser, five calculators, and a search that isn't limited to one month.",
    changes: [
      {
        kind: "new",
        title: "Switch between your accounts",
        body: "The avatar now opens a menu: settings, logging out, and every account signed in on this browser. Each keeps its own session, so switching back is instant rather than another password.",
      },
      {
        kind: "new",
        title: "Calculators",
        body: "A Tools tab with five, one at a time: compound interest, how long a savings target takes, clearing a card or loan, what a loan repays at, and what money will be worth after inflation. Each draws the projection it is describing.",
      },
      {
        kind: "new",
        title: "Search across every month",
        body: "The Transactions filter can look through your whole history instead of only the month on screen — for the receipt you can't remember the date of.",
      },
      {
        kind: "new",
        title: "Editing accounts in one place",
        body: "Edit accounts renames them, changes what kind they are, removes them, and sets the order they appear in on the Overview — by dragging, or with the arrows.",
      },
      {
        kind: "new",
        title: "A drinks category",
        body: "Alongside groceries, dining out and coffee.",
      },
      {
        kind: "fixed",
        title: "Names ending in a space now save",
        body: "A profile field typed with a trailing space was trimmed on save but compared untrimmed, so the form never admitted it had saved. The space is now removed for you.",
      },
      {
        kind: "fixed",
        title: "Goals for paying off a card or loan",
        body: "These could be refused on saving without saying why. The reason is now stated in full.",
      },
    ],
  },
  {
    date: "2026-08-28",
    label: "28 August 2026",
    summary: "What you owe, what you're saving towards, and making the app look like yours.",
    changes: [
      {
        kind: "new",
        title: "Loans, credit cards and mortgages",
        body: "Recorded as what you owe rather than as a negative balance to interpret, netted off your total automatically, and paid down with a transfer that moves them back toward zero.",
      },
      {
        kind: "new",
        title: "Goals for paying off debt",
        body: "Set how much you mean to clear this month, budgeted out of the same income target as saving, investing and your spending limits.",
      },
      {
        kind: "new",
        title: "Savings targets on an account",
        body: "A cumulative figure to save up to, measured against the account's balance rather than against one month.",
      },
      {
        kind: "new",
        title: "Where the month's income is going",
        body: "An allocation bar on the Budget page showing how much of your income target is already promised, and to what.",
      },
      {
        kind: "new",
        title: "Profile picture and background",
        body: "A picture of your own on the avatar, and a photograph behind the dashboard if you want one.",
      },
      {
        kind: "new",
        title: "Data controls",
        body: "Change your password, start again from empty, or delete your account outright — each behind a confirmation that spells out what is lost.",
      },
    ],
  },
  {
    date: "2026-08-27",
    label: "27 August 2026",
    summary: "Entries that record themselves, entries dated ahead, and a public site around the app.",
    changes: [
      {
        kind: "new",
        title: "Recurring entries",
        body: "A standing instruction that records salary, rent or a subscription as each one falls due — dated the day it was due, not the day you next opened the app.",
      },
      {
        kind: "new",
        title: "Future-dated entries",
        body: "Write a bill down before it lands. It sits in the month's list without touching your balance, and starts counting on the day it arrives.",
      },
      {
        kind: "new",
        title: "A public site",
        body: "A home page and an About page, sharing one header and footer with the app.",
      },
      {
        kind: "improved",
        title: "Choosing a category",
        body: "Grouped rather than one long grid, searchable, and sized for a phone.",
      },
    ],
  },
  {
    date: "2026-08-26",
    label: "26 August 2026",
    summary: "The app itself: accounts, a full ledger, monthly budgets and reporting.",
    changes: [
      {
        kind: "new",
        title: "Accounts",
        body: "Spending, cash, savings and investments, each with a name of your own and a balance that follows every entry you record.",
      },
      {
        kind: "new",
        title: "The ledger",
        body: "Income, expenses, transfers, and the gains and losses nobody moved. Every entry is editable and reversible, and its effect on your balances is saved in the same step so the two can never disagree.",
      },
      {
        kind: "new",
        title: "Monthly budgets",
        body: "Each month carries its own plan, anchored to what you expect to earn: saving, investing and every spending limit is budgeted out of that figure, so you can't promise more than comes in.",
      },
      {
        kind: "new",
        title: "The Overview",
        body: "What every account holds, what it opened the month at, and what happened to it since.",
      },
      {
        kind: "new",
        title: "Statistics",
        body: "How your balances have moved over the past year, and where the month's money actually went.",
      },
      {
        kind: "new",
        title: "Opening balances",
        body: "A first-run setup that asks what you already hold, so the running totals are right from the first entry.",
      },
      {
        kind: "new",
        title: "Search and filtering",
        body: "Find an entry by its note, category, account or amount, and narrow the list to one kind.",
      },
      {
        kind: "new",
        title: "Forgotten passwords",
        body: "A reset link by email, which answers the same way whether or not the address has an account.",
      },
      {
        kind: "new",
        title: "Currency, theme and accent",
        body: "Twenty-six currencies with the grouping that suits each, a light and dark theme that can follow your system, and six accent colours.",
      },
      {
        kind: "new",
        title: "Private by design",
        body: "Your data goes straight to Firestore under security rules that limit every read and write to your own account.",
      },
    ],
  },
  {
    date: "2026-08-25",
    label: "25 August 2026",
    summary: "The first version: a way in.",
    changes: [
      {
        kind: "new",
        title: "Accounts and signing in",
        body: "Sign up with an email address and password, or continue with Google.",
      },
    ],
  },
];

/** The most recent release, for the line under the page's heading. */
export const LATEST = RELEASES[0];
