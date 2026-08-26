# Budget Tracker

A personal budgeting app built on Next.js and Firebase. It answers three
questions, in this order: **how much have I got**, **where did it go**, and
**am I on track for the month I'm looking at**.

Everything is scoped to one signed-in user. There is no server of ours in the
middle — the browser talks to Firestore directly, and the security rules in
`firestore.rules` are the real access control.

---

## What it does

**Accounts.** Add one for every place you keep money — a current account, a
coin jar, a pension — and one for everywhere you owe it. Debt accounts (a card,
a loan, a mortgage) hold a negative balance, so they net off your total
automatically, and every direction word flips: money moving *into* one is a
repayment, and a balance going up means the debt went down.

**A ledger that always balances.** Income, expenses, transfers and balance
adjustments are recorded as entries, and each one moves the accounts it touches
in the same atomic write. Amounts are stored as integer cents and are never
signed — the *kind* of entry carries the direction. Correcting an entry re-reads
what it originally did and re-settles the difference, so fixing a typo fixes the
history and the money together.

**Months are real boundaries.** A past month's closing balance is derived by
rewinding today's running total through everything recorded since, so looking at
July shows July — and nothing you record now can quietly rewrite it.

**A plan per month.** Set what you mean to earn, what you'll move into savings
and investments, and a ceiling per spending category. Income is the ceiling
everything else is drawn from: the app refuses to let you promise more than you
expect to earn, and the allocation bar shows the month's income target split
into the parts it's been promised to — green for saving, violet for investing,
orange for spending limits — with the tail nobody has claimed yet.

**Categories you pick by looking.** Around forty categories across nine groups,
chosen from a searchable grid of icons rather than a dropdown.

**Settings.** Currency (and the number formatting that goes with it), light /
dark / system theme, an accent colour, your name, pronouns and avatar, and a
password reset link — plus the two irreversible ones, behind a confirmation that
can't be clicked through. Resetting your data drops you back on the Overview
with the opening-balances prompt already open.

---

## Getting started

### 1. Requirements

- Node.js 20 or newer
- A Firebase project with **Authentication** and **Cloud Firestore** enabled

### 2. Install

```bash
npm install
```

### 3. Set up Firebase

In the [Firebase console](https://console.firebase.google.com):

1. Create a project (or open an existing one).
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. **Firestore Database**: create a database.
4. **Project settings → Your apps**: register a Web app and copy its config.

### 4. Environment variables

Create `.env.local` in the project root:

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...
```

These are public by design — a Firebase web config identifies the project, it
doesn't authorise anything. What actually protects the data is the rules file.

### 5. Deploy the security rules

Without this step Firestore will either refuse every read or allow every one,
depending on the mode you picked when creating the database. Neither is what
you want.

```bash
npm install -g firebase-tools   # once
firebase login
firebase use --add              # pick your project
firebase deploy --only firestore:rules
```

### 6. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, create an account, and follow the verification
link emailed to you — sign-in refuses an unverified address. On first load the
app asks which accounts you keep money in and what's in them. Forgotten your
password? The login page emails a reset link, and so does **Settings → Signing
in**.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server on :3000 |
| `npm run build` | Production build (type-checks as part of it) |
| `npm run start` | Serve the production build |
| `npm run lint` | ESLint |

---

## How it's put together

```
app/
  (auth)/            Login and sign-up
  dashboard/
    page.tsx         Overview — balances and one line on the plan
    transactions/    The ledger, filtered and grouped by day
    budget/          The month's plan and the allocation bar
    statistics/      Trend, category breakdown, account growth
    settings/        Profile, appearance, currency, danger zone
components/
  budgets/           Goal cards, the goal form, the allocation bar
  dashboard/         Account cards, charts, dialogs, the shell
  settings/          Profile, appearance and the danger zone
  ui/                Button, Dialog, Field, Icon — the whole primitive set
lib/
  auth/              Firebase Auth context and error mapping
  budget/            Types, the ledger, Firestore access, analytics
  firebase/          Client SDK initialisation
  settings/          Preferences and the provider that applies them
firestore.rules      The actual access control
```

### The pieces worth knowing

**`lib/budget/ledger.ts`** — what one entry does to the balance sheet, with no
Firestore in sight. Adding applies the deltas, deleting applies their negation,
editing applies the difference, and past-month views replay them backwards.
Every balance in the app comes out of this one function.

**`lib/budget/transactions.ts`** — the Firestore side of the same thing. Each
mutation runs in a transaction that settles the affected accounts and writes the
entry together, so an entry can never land without its balance change.

**`lib/budget/analytics.ts`** — pure functions over accounts, entries and goals:
month summaries, goal progress, the category breakdown, the growth series and
the allocation breakdown. No I/O, so it can be reasoned about on its own.

**`lib/budget/use-budget.ts`** — one subscription window over the ledger (a year
back through everything after the month on screen) serving the month view, the
rewind and the growth chart at once.

**`lib/settings/settings-context.tsx`** — applies the two preferences that can't
travel as props: money formatting, which is called from analytics sentences and
chart tooltips that have no React context, and the theme, which is an attribute
on the document element.

### Data model

```
users/{uid}                                 preferences + the onboarding flag
users/{uid}/accounts/{accountId}            name, type, balanceCents, order
users/{uid}/transactions/{transactionId}    kind, accountId, toAccountId,
                                            amountCents, categoryId, note, date
users/{uid}/budgets/{YYYY-MM}/goals/{id}    scope, categoryId, amountCents
```

Money is integer cents everywhere and is only divided by 100 at the point it is
printed. Amounts are always positive; direction lives in `kind`. Account types
are `spending`, `cash`, `savings`, `investments` and `debt` — and a `debt`
account is simply one whose balance is meant to be below zero.

---

## Conventions

- **Never store money as a float.** Integer cents in, `formatMoney` out.
- **Never sign an amount.** `kind` carries the direction; `deltasFor` turns the
  two into balance movements.
- **Ids are permanent.** Category ids are referenced by every transaction ever
  recorded and by goal document ids — they can be added to, never renamed.
- **Colour follows identity, not size.** Accounts take a palette slot by
  position and keep it; budget scopes keep one colour wherever they appear.
- **Comments explain why.** The code says what it does; a comment is for the
  reason it does it that way.

## Deploying

Any host that runs Next.js will do. On [Vercel](https://vercel.com), import the
repository and add the same `NEXT_PUBLIC_FIREBASE_*` variables under Project
Settings → Environment Variables. Add your production domain to **Firebase
Authentication → Settings → Authorized domains**, or Google sign-in will be
rejected there.
