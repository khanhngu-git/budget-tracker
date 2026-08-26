/**
 * Money is stored as integer cents everywhere and only converted at the edges,
 * so repeated adds and transfers can't accumulate binary-float error.
 */

/**
 * How money is written, held as module state rather than threaded through
 * every call site.
 *
 * Formatting shows up in analytics sentences, chart tooltips and account cards
 * alike — none of which have any business knowing which currency the user
 * picked. The settings provider sets this once, above the dashboard, and every
 * `formatMoney` in the tree picks it up. Safe because the dashboard is behind
 * an auth splash: nothing money-shaped is ever rendered on the server, so a
 * currency other than the default can't cause a hydration mismatch.
 */
let currency = "USD";
let locale = "en-US";
/** Whole units only — for someone who doesn't want to read cents all day. */
let hideCents = false;

export function setMoneyFormat(next: {
  currency?: string;
  locale?: string;
  hideCents?: boolean;
}): void {
  if (next.currency) currency = next.currency;
  if (next.locale) locale = next.locale;
  if (next.hideCents !== undefined) hideCents = next.hideCents;
}

export function moneyFormat(): {
  currency: string;
  locale: string;
  hideCents: boolean;
} {
  return { currency, locale, hideCents };
}

/**
 * How many decimal places the chosen currency actually has.
 *
 * Not every currency has two: yen and đồng have none, and forcing "¥1,234.00"
 * onto them writes an amount no reader of that currency has ever seen. Cached
 * because resolving it builds a formatter, and this is called for every figure
 * on the page.
 */
const digitsByCurrency = new Map<string, number>();

function currencyDigits(): number {
  const cached = digitsByCurrency.get(currency);
  if (cached !== undefined) return cached;

  const resolved = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const digits = Math.min(2, resolved ?? 2);

  digitsByCurrency.set(currency, digits);
  return digits;
}

export function formatMoney(cents: number, { compact = false } = {}): string {
  const digits = compact || hideCents ? 0 : currencyDigits();
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(cents / 100);
}

/** The symbol on its own — for a field label, where the amount is typed bare. */
export function currencySymbol(): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
  }).formatToParts(0);
  return parts.find((part) => part.type === "currency")?.value ?? "";
}

export function formatSignedMoney(cents: number): string {
  const sign = cents > 0 ? "+" : cents < 0 ? "−" : "";
  return `${sign}${formatMoney(Math.abs(cents))}`;
}

function parseToCents(input: string): number | null {
  // Everything that isn't a digit, a decimal point or a leading minus is
  // grouping or a currency symbol — and which symbol that is now depends on
  // the user's currency, so nothing may be hard-coded here.
  const trimmed = input.trim().replace(/[^\d.-]/g, "");
  if (
    !/^-?\d*\.?\d{0,2}$/.test(trimmed) ||
    trimmed === "" ||
    trimmed === "." ||
    trimmed === "-"
  ) {
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

/**
 * A balance that is allowed to be below zero.
 *
 * Debt accounts are the whole reason this exists: a loan or a credit card is
 * money you hold *less* of than nothing, and forcing it positive would file a
 * mortgage as an asset.
 */
export function parseSignedBalanceToCents(input: string): number | null {
  return parseToCents(input);
}

export function formatDay(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
  }).format(date);
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "Aug" — for axis ticks, where the year is carried by the axis itself. */
export function formatMonthShort(date: Date): string {
  return new Intl.DateTimeFormat(locale, { month: "short" }).format(date);
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

/**
 * The heading a day's entries sit under.
 *
 * Recent days are named rather than dated: "Today" and "Yesterday" are how
 * people refer to the entries they're most likely to be correcting, and a date
 * makes the reader do the conversion themselves.
 */
export function formatDayHeading(date: Date, now: Date = new Date()): string {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysApart = Math.round(
    (today.getTime() - day.getTime()) / (24 * 60 * 60 * 1000),
  );

  if (daysApart === 0) return "Today";
  if (daysApart === 1) return "Yesterday";

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    month: "long",
    // The month view already says which year, except when it doesn't.
    year: day.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(day);
}

/** Stable "2026-08-14" key for the day a date falls in. */
export function dayKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
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

/* ── Day, week and year boundaries ──────────────────────────────────── */

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Day arithmetic done on the calendar for the same reason month arithmetic is:
 * adding 24 hours' worth of milliseconds lands on the wrong day either side of
 * a daylight-saving change.
 */
export function addDays(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + delta);
}

/** Monday — the week people mean when they say "this week" in a budget. */
export function startOfWeek(date: Date): Date {
  const day = startOfDay(date);
  // getDay() is Sunday-first, so Sunday (0) is six days into its week.
  const offset = (day.getDay() + 6) % 7;
  return addDays(day, -offset);
}

export function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

export function addYears(date: Date, delta: number): Date {
  return new Date(date.getFullYear() + delta, 0, 1);
}

/** "Aug 14" — for axis ticks, where the year is carried by the axis itself. */
export function formatDayShort(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
  }).format(date);
}

/** "14 August 2026" — the long form, for a readout line that has the room. */
export function formatDayLong(date: Date): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}
