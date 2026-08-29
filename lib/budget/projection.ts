/**
 * Forward-looking arithmetic: what a balance becomes, and how long a target
 * takes.
 *
 * Nothing here reads Firestore or the ledger. These are the two questions
 * people ask a calculator — "what will this be worth?" and "when do I get
 * there?" — answered by simulating month by month rather than by a closed-form
 * annuity formula. The simulation is what makes a chart possible at all: the
 * same run that produces the final figure produces every point on the way to
 * it, so the number and the curve can never disagree.
 *
 * Money is carried as a float inside a run and rounded only on the way out.
 * Rounding to whole cents every month would compound the rounding error along
 * with the interest, which over thirty years is visible.
 */

export const COMPOUND_FREQUENCIES = [
  "daily",
  "monthly",
  "quarterly",
  "yearly",
] as const;
export type CompoundFrequency = (typeof COMPOUND_FREQUENCIES)[number];

export const COMPOUND_FREQUENCY_LABELS: Record<CompoundFrequency, string> = {
  daily: "Daily",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
};

const PERIODS_PER_YEAR: Record<CompoundFrequency, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  yearly: 1,
};

/**
 * The factor one month multiplies a balance by.
 *
 * Derived from the compounding period rather than assuming monthly, so
 * "quarterly at 5%" really is `(1 + 0.05/4)` applied four times a year. The
 * months inside a quarter get the smooth twelfth-root of it: the quarter-end
 * figure is exactly right, and the points in between are the honest
 * interpolation rather than a flat line followed by a cliff.
 */
export function monthlyFactor(
  annualRate: number,
  frequency: CompoundFrequency,
): number {
  const periods = PERIODS_PER_YEAR[frequency];
  return (1 + annualRate / periods) ** (periods / 12);
}

/** One month of a projection, closing figures. */
export type ProjectionPoint = {
  /** Months from now. 0 is today, before anything has been added. */
  month: number;
  balanceCents: number;
  /** Everything paid in so far, the opening balance included. */
  contributedCents: number;
  /** What the rate did: balance minus what was paid in. */
  interestCents: number;
};

export type CompoundInput = {
  /** What's there to begin with. */
  initialCents: number;
  /** Paid in at the end of every month. */
  monthlyCents: number;
  /** Nominal annual rate as a fraction — 0.05 for 5%. */
  annualRate: number;
  months: number;
  frequency: CompoundFrequency;
};

/**
 * The whole path, one point per month, starting at month zero.
 *
 * Contributions land at the end of the month — the ordinary-annuity
 * convention, and the one that matches a standing order: this month's payment
 * has not earned this month's interest.
 */
export function projectCompound(input: CompoundInput): ProjectionPoint[] {
  const factor = monthlyFactor(input.annualRate, input.frequency);
  const months = Math.max(0, Math.round(input.months));

  let balance = input.initialCents;
  let contributed = input.initialCents;

  const points: ProjectionPoint[] = [
    {
      month: 0,
      balanceCents: Math.round(balance),
      contributedCents: Math.round(contributed),
      interestCents: 0,
    },
  ];

  for (let month = 1; month <= months; month += 1) {
    balance = balance * factor + input.monthlyCents;
    contributed += input.monthlyCents;
    points.push({
      month,
      balanceCents: Math.round(balance),
      contributedCents: Math.round(contributed),
      interestCents: Math.round(balance - contributed),
    });
  }

  return points;
}

/* ── How long until I get there ─────────────────────────────────────── */

/**
 * The point at which a projection stops being a plan and starts being a
 * fantasy. Eighty-three years is long enough that any real target inside a
 * lifetime is found, and short enough that an unreachable one fails fast.
 */
const MAX_MONTHS = 1000;

export type SavingsInput = {
  /** What's already saved. */
  currentCents: number;
  targetCents: number;
  /** Paid in at the end of every month. */
  monthlyCents: number;
  annualRate: number;
  frequency: CompoundFrequency;
  /** Paid in today, before the first month runs. */
  lumpSumCents: number;
};

export type SavingsPlan = {
  /** Months until the target is met, or null if it never is. */
  months: number | null;
  /** The whole path up to the month the target is met (or the cap). */
  points: ProjectionPoint[];
  /** What was paid in over those months, the opening balance excluded. */
  paidInCents: number;
  interestCents: number;
};

/**
 * Runs a savings plan to the month its target is met.
 *
 * `months: null` means it never is inside the cap, which is a real answer and
 * not an error — with no contributions and no interest, a target above the
 * balance simply never arrives, and saying so is more use than a number.
 */
export function projectSavings(input: SavingsInput): SavingsPlan {
  const factor = monthlyFactor(input.annualRate, input.frequency);
  const opening = input.currentCents + input.lumpSumCents;

  let balance = opening;
  let contributed = opening;

  const points: ProjectionPoint[] = [
    {
      month: 0,
      balanceCents: Math.round(balance),
      contributedCents: Math.round(contributed),
      interestCents: 0,
    },
  ];

  const done = (cents: number) => cents >= input.targetCents;
  let months: number | null = done(balance) ? 0 : null;

  for (let month = 1; months === null && month <= MAX_MONTHS; month += 1) {
    const before = balance;
    balance = balance * factor + input.monthlyCents;
    contributed += input.monthlyCents;
    points.push({
      month,
      balanceCents: Math.round(balance),
      contributedCents: Math.round(contributed),
      interestCents: Math.round(balance - contributed),
    });

    if (done(balance)) months = month;
    // Standing still: no contribution, and a rate that isn't moving the
    // balance either. Running the remaining 900 months would change nothing.
    else if (input.monthlyCents === 0 && balance <= before) break;
  }

  const last = points[points.length - 1];
  return {
    months,
    points,
    paidInCents: last.contributedCents - Math.round(opening),
    interestCents: last.interestCents,
  };
}

/** "3 years, 2 months" — the unit people actually think in, past a year. */
export function formatMonths(months: number): string {
  if (months === 0) return "straight away";
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"}`;

  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearPart = `${years} ${years === 1 ? "year" : "years"}`;
  if (rest === 0) return yearPart;
  return `${yearPart}, ${rest} ${rest === 1 ? "month" : "months"}`;
}

/* ── Borrowing ──────────────────────────────────────────────────────── */

/**
 * Loans compound monthly, and that isn't a setting.
 *
 * A savings rate is a choice between products; a loan's is a term of the
 * contract, and every mortgage, car loan and card statement in circulation
 * quotes a nominal annual rate charged as a twelfth of itself each month.
 * Offering "yearly compounding" on a repayment schedule would let someone
 * model a loan nobody issues.
 */
export function monthlyRate(annualRate: number): number {
  return annualRate / 12;
}

/**
 * The level payment that clears a principal over a term — the annuity formula.
 *
 * At zero interest it degenerates: the closed form divides by the rate, so the
 * plain division is the answer and the formula is skipped rather than guarded
 * downstream.
 */
export function levelPayment(
  principalCents: number,
  annualRate: number,
  months: number,
): number {
  if (months <= 0) return principalCents;
  const rate = monthlyRate(annualRate);
  if (rate === 0) return principalCents / months;
  return (principalCents * rate) / (1 - (1 + rate) ** -months);
}

/** One month of a repayment schedule, closing figures. */
export type RepaymentPoint = {
  month: number;
  /** Still owed at the end of this month. Never below zero. */
  balanceCents: number;
  /** Interest charged from the start up to here. */
  interestCents: number;
  /** Everything handed over from the start up to here. */
  paidCents: number;
};

export type Repayment = {
  /** Months until it's cleared, or null when the payment never clears it. */
  months: number | null;
  points: RepaymentPoint[];
  interestCents: number;
  paidCents: number;
  /** The last payment, which is usually smaller than the rest. */
  finalPaymentCents: number;
};

/**
 * Runs a debt down under a fixed monthly payment.
 *
 * Interest is charged on the opening balance and the payment applied after,
 * which is how a statement reads. A payment that doesn't cover the month's
 * interest never clears anything, and that comes back as `months: null` rather
 * than as a thousand rows of a balance quietly climbing.
 */
export function amortise(
  principalCents: number,
  annualRate: number,
  paymentCents: number,
): Repayment {
  const rate = monthlyRate(annualRate);

  let balance = Math.max(0, principalCents);
  let interest = 0;
  let paid = 0;
  let finalPayment = paymentCents;

  const points: RepaymentPoint[] = [
    { month: 0, balanceCents: Math.round(balance), interestCents: 0, paidCents: 0 },
  ];

  let months: number | null = balance <= 0 ? 0 : null;

  for (let month = 1; months === null && month <= MAX_MONTHS; month += 1) {
    const charged = balance * rate;
    // The payment can't take more than is owed: the last one is whatever is
    // left, which is what makes the totals add up to the penny.
    const payment = Math.min(paymentCents, balance + charged);
    if (payment <= charged) break;

    balance = balance + charged - payment;
    interest += charged;
    paid += payment;
    finalPayment = payment;

    points.push({
      month,
      balanceCents: Math.round(Math.max(0, balance)),
      interestCents: Math.round(interest),
      paidCents: Math.round(paid),
    });

    if (balance <= 0.5) months = month;
  }

  return {
    months,
    points,
    interestCents: Math.round(interest),
    paidCents: Math.round(paid),
    finalPaymentCents: Math.round(finalPayment),
  };
}

/* ── What money is worth later ──────────────────────────────────────── */

/**
 * The same amount, year by year, in today's money.
 *
 * Inflation is the one projection where the line going *down* is the whole
 * point: nothing is being spent, and the figure still shrinks. The second
 * series — what the same basket costs in future money — is the same fact from
 * the other end, and people recognise one or the other.
 */
export type RealValuePoint = {
  month: number;
  /** What today's amount will buy then, priced in today's money. */
  realCents: number;
  /** What today's basket will cost then, in that year's money. */
  nominalCents: number;
};

export function projectRealValue(
  amountCents: number,
  annualInflation: number,
  months: number,
): RealValuePoint[] {
  const monthly = (1 + annualInflation) ** (1 / 12);
  const points: RealValuePoint[] = [];

  for (let month = 0; month <= Math.max(0, Math.round(months)); month += 1) {
    const growth = monthly ** month;
    points.push({
      month,
      realCents: Math.round(amountCents / growth),
      nominalCents: Math.round(amountCents * growth),
    });
  }

  return points;
}
