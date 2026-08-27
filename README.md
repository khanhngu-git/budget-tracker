# Budget Tracker

A personal budgeting app built with Next.js, Firebase Authentication, and
Cloud Firestore. Track accounts, transactions, recurring entries, monthly
budgets, goals, and historical balance changes for one signed-in user.

## Features

- Account balances, transfers, adjustments, debt accounts, and account ordering
- Income, expense, and future-dated transactions with searchable categories
- Recurring entries with weekly, fortnightly, monthly, and yearly schedules
- Monthly budgets with savings, investment, and category allocations
- Overview, statistics, balance history, expense breakdowns, and month views
- Profile, avatar, currency, theme, accent, password, and data reset settings
- Firebase security rules that scope user data to the authenticated owner

## Getting started

### Requirements

- Node.js 20 or newer
- A Firebase project with Email/Password or Google Authentication enabled
- Cloud Firestore enabled in the same Firebase project

### Install

```bash
npm install
```

Create `.env.local` in the project root with the Firebase web configuration:

```dotenv
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

Deploy the Firestore rules after selecting your Firebase project:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the development server |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server |

## Data model

All user data lives under the authenticated user's document:

```
users/{uid}/accounts/{accountId}
users/{uid}/transactions/{transactionId}
users/{uid}/budgets/{YYYY-MM}/goals/{goalId}
users/{uid}/recurring/{ruleId}
users/{uid}/preferences
```

Money is stored as integer cents. Amounts remain positive and transaction kind
determines direction. Firestore rules are the access-control boundary; the
Firebase web configuration is public, but service-account credentials must
never be committed.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
