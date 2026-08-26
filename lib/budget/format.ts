/**
 * Money is stored as integer cents everywhere and only converted at the edges,
 * so repeated adds and transfers can't accumulate binary-float error.
 */

const CURRENCY = "USD";
const LOCALE = "en-US";

export function formatMoney(cents: number, { compact = false } = {}): string {
  return new Intl.NumberFormat(LOCALE, {
    style: "currency",
    currency: CURRENCY,
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(cents / 100);
}

export function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(cents))}`;
}

function parseToCents(input: string): number | null {
  const trimmed = input.trim().replace(/[$,\s]/g, "");
  if (!/^\d*\.?\d{0,2}$/.test(trimmed) || trimmed === "" || trimmed === ".") {
    return null;
  }
  // Round after scaling: parseFloat("19.99") * 100 is 1998.9999... in binary float.
  const cents = Math.round(Number(trimmed) * 100);
  return Number.isFinite(cents) ? cents : null;
}

/**
 * Parses a user-typed amount into integer cents.
 * Returns null for anything that isn't a positive, well-formed amount.
 */
export function parseAmountToCents(input: string): number | null {
  const cents = parseToCents(input);
  return cents !== null && cents > 0 ? cents : null;
}

/**
 * Same, but zero is a legitimate answer — an account really can be emptied,
 * and refusing to record that would leave a stale balance on screen forever.
 */
export function parseBalanceToCents(input: string): number | null {
  const cents = parseToCents(input);
  return cents !== null && cents >= 0 ? cents : null;
}

export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "Aug" — for axis ticks, where the year is carried by the axis itself. */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat(LOCALE, { month: "short" }).format(date);
}

/**
 * A share as a whole percentage. Anything under 1% that isn't actually zero
 * gets a decimal rather than rounding down to "0%", which would read as
 * "nothing" for money that was really allocated.
 */
export function formatPercent(share: number): string {
  const value = share * 100;
  if (value > 0 && value < 1) return `${value.toFixed(1)}%`;
  return `${Math.round(value)}%`;
}

/** Local-time YYYY-MM-DD, for <input type="date"> round-tripping. */
export function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Parses a YYYY-MM-DD input value as local midnight (not UTC). */
export function fromDateInputValue(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/**
 * The date an entry should default to when a given month is on screen.
 *
 * Now the month is a real boundary, defaulting to today would drop an entry
 * into a month the user isn't looking at — it would appear to vanish. Inside
 * the current month that's still today; in a past month it's the last day.
 */
export function defaultDateFor(monthStart: Date, now: Date = new Date()): Date {
  const monthEnd = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1,
  );
  // Day 0 of the next month is the last day of this one — no arithmetic on
  // milliseconds, so daylight saving can't shift it onto the wrong date.
  if (now >= monthEnd) {
    return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  }
  if (now < monthStart) return monthStart;
  return now;
}

/** Stable "2026-08" key for the month a date falls in. Used as a document id. */
export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/* ── Month boundaries ───────────────────────────────────────────────── */

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Month arithmetic done on the calendar rather than on milliseconds, so a
 * daylight-saving change can't land the result on the wrong day.
 */
export function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

export function endOfMonth(monthStart: Date): Date {
  return addMonths(monthStart, 1);
}

export function isInMonth(date: Date, monthStart: Date): boolean {
  return (
    date.getFullYear() === monthStart.getFullYear() &&
    date.getMonth() === monthStart.getMonth()
  );
}
