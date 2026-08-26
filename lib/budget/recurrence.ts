import { addDays, startOfDay } from "./format";

/**
 * When a scheduled entry falls due, with no Firestore in sight.
 *
 * Kept separate from the Firestore side for the same reason `ledger.ts` is:
 * dates are where this feature can quietly go wrong — a rule anchored on the
 * 31st, a fortnight that crosses a daylight-saving boundary, a February 29th
 * — and none of that needs a database to reason about or to test.
 */

export const FREQUENCIES = [
  "weekly",
  "fortnightly",
  "monthly",
  "yearly",
] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/** "every week" — reads better than the adjective inside a sentence. */
export const FREQUENCY_EVERY: Record<Frequency, string> = {
  weekly: "every week",
  fortnightly: "every fortnight",
  monthly: "every month",
  yearly: "every year",
};

/**
 * How many occurrences one catch-up will post for a single rule.
 *
 * A weekly rule left alone for four years is the shape this guards against:
 * without a ceiling, one forgotten schedule could write hundreds of entries in
 * a single pass. Whatever it doesn't reach stays due, and the next run
 * continues from where this one stopped.
 */
export const MAX_PER_RUN = 200;

/** Stops a malformed rule spinning: far more periods than any rule will need. */
const MAX_STEPS = 20000;

function daysInMonth(year: number, monthIndex: number): number {
  // Day 0 of the next month is the last day of this one.
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * The `index`th occurrence of a rule, counted from its start date.
 *
 * Always measured from the anchor rather than by stepping off the previous
 * occurrence, which is what keeps a rule anchored on the 31st landing on the
 * 31st: stepping would clamp January's to February's 28th and then carry that
 * 28th forward forever. Anchoring re-derives each date from the original day
 * of the month, so only the short months are clamped.
 */
export function occurrenceAt(
  start: Date,
  frequency: Frequency,
  index: number,
): Date {
  const anchor = startOfDay(start);

  switch (frequency) {
    // Day arithmetic, not milliseconds: adding 7 × 24h across a daylight-saving
    // change would land an hour off and, at the edges, on the wrong date.
    case "weekly":
      return addDays(anchor, 7 * index);
    case "fortnightly":
      return addDays(anchor, 14 * index);
    case "monthly": {
      const month = new Date(anchor.getFullYear(), anchor.getMonth() + index, 1);
      const year = month.getFullYear();
      const monthIndex = month.getMonth();
      return new Date(
        year,
        monthIndex,
        Math.min(anchor.getDate(), daysInMonth(year, monthIndex)),
      );
    }
    case "yearly": {
      const year = anchor.getFullYear() + index;
      // A rule anchored on 29 February falls on the 28th in common years.
      return new Date(
        year,
        anchor.getMonth(),
        Math.min(anchor.getDate(), daysInMonth(year, anchor.getMonth())),
      );
    }
  }
}

/** The parts of a rule that decide when it fires. */
export type Schedule = {
  frequency: Frequency;
  startDate: Date;
  /** null means "until further notice". */
  endDate: Date | null;
  /** The last occurrence already posted, or null if the rule has never run. */
  lastRunDate: Date | null;
};

/**
 * Every occurrence that has come due and hasn't been posted yet.
 *
 * `lastRunDate` is the whole guard against double-posting: occurrences on or
 * before it have already been written, so a second catch-up — a second tab, a
 * reload, React running an effect twice in development — finds nothing left to
 * do.
 */
export function dueOccurrences(
  schedule: Schedule,
  now: Date,
  cap: number = MAX_PER_RUN,
): Date[] {
  const through = startOfDay(now).getTime();
  const end = schedule.endDate ? startOfDay(schedule.endDate).getTime() : null;
  const after = schedule.lastRunDate
    ? startOfDay(schedule.lastRunDate).getTime()
    : null;

  const due: Date[] = [];

  for (let index = 0; index < MAX_STEPS; index += 1) {
    const at = occurrenceAt(schedule.startDate, schedule.frequency, index);
    const time = at.getTime();

    if (time > through) break;
    if (end !== null && time > end) break;

    if (after === null || time > after) {
      due.push(at);
      if (due.length >= cap) break;
    }
  }

  return due;
}

/**
 * The next date this rule will fire, or null if it never will again.
 *
 * Today counts — a rule due today that hasn't run yet is next due today, not
 * next week.
 */
export function nextOccurrence(schedule: Schedule, now: Date): Date | null {
  const today = startOfDay(now).getTime();
  const end = schedule.endDate ? startOfDay(schedule.endDate).getTime() : null;
  const after = schedule.lastRunDate
    ? startOfDay(schedule.lastRunDate).getTime()
    : null;

  for (let index = 0; index < MAX_STEPS; index += 1) {
    const at = occurrenceAt(schedule.startDate, schedule.frequency, index);
    const time = at.getTime();

    if (end !== null && time > end) return null;
    if (time >= today && (after === null || time > after)) return at;
  }

  return null;
}
