# Budget Tracker

A comprehensive personal budgeting app built with Next.js, Firebase Authentication,
and Cloud Firestore. Track accounts, transactions, recurring entries, monthly budgets,
goals, and historical balance changes. Includes financial calculators and projection tools
for one authenticated user.

## Features

### Accounts & Transactions
- Account balances, transfers, adjustments, and debt account support
- Income, expense, and future-dated transactions with searchable categories
- Recurring entries with weekly, fortnightly, monthly, and yearly schedules
- Transaction history with filtering and bulk operations
- Session switching for multi-user access

### Budget & Goals
- Monthly budgets with savings, investment, and category allocations
- Income-anchored goal planning with progress tracking
- Category-based spending limits and allocation visualization
- Account-aware budget scopes based on account types

### Analytics & Visualization
- Overview dashboard with account balances and month summaries
- Statistics page showing expense breakdowns and balance history
- Growth charts tracking balance changes over configurable periods
- Expense pie charts by category
- Real-time balance calculations and settlement tracking

### Financial Tools
- Savings calculator: project future savings growth
- Loan calculator: compute monthly payments and total interest
- Payoff calculator: estimate debt payoff timeline
- Compound interest calculator: model investment growth
- Inflation calculator: adjust amounts for inflation impact
- Projection charts: visualize financial scenarios

### Settings & Profile
- User profile with avatar upload and preferences
- Currency selection with localized number formatting
- Theme selection (light/dark/system)
- Accent color customization
- Password reset and data security controls

### Infrastructure
- Firebase Authentication (email/password and Google)
- Cloud Firestore with security rules for user data isolation
- Optimized data model with integer-cent money storage
- Service account integration for backend operations

## Getting Started

### Requirements

- Node.js 20 or newer
- A Firebase project with Email/Password or Google Authentication enabled
- Cloud Firestore enabled in the same Firebase project

### Installation

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

Deploy the Firestore security rules:

```bash
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules
```

Start the development server:

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

## Architecture

### Data Model

All user data lives under the authenticated user's document:

```
users/{uid}/accounts/{accountId}
users/{uid}/transactions/{transactionId}
users/{uid}/budgets/{YYYY-MM}/goals/{goalId}
users/{uid}/recurring/{ruleId}
users/{uid}/preferences
```

### Money Handling

- All amounts stored as integer cents
- Amounts remain positive; transaction kind determines direction
- Never stored as floats; always divided by 100 only at display time

### Security

- Firestore rules are the access-control boundary
- Firebase web configuration is public
- Service-account credentials must never be committed
- User data fully scoped to authenticated user only
