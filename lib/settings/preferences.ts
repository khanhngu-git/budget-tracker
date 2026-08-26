import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

/**
 * Everything about the app that is the user's taste rather than their money.
 *
 * It all lives on the one `users/{uid}` document alongside the onboarding flag,
 * because it is a handful of scalars read on every load — a subcollection would
 * cost an extra listener to store less than a kilobyte.
 */

export function profileDoc(uid: string) {
  return doc(db, "users", uid);
}

/* ── Currency ───────────────────────────────────────────────────────── */

export type CurrencyOption = {
  /** ISO 4217. What `Intl.NumberFormat` is actually given. */
  code: string;
  label: string;
  /** The locale whose grouping and symbol placement suit that currency. */
  locale: string;
};

/**
 * Currencies offered by name, not typed as a code.
 *
 * The locale travels with the currency because the two are not independent:
 * €1.234,56 and €1,234.56 are the same amount written for different readers,
 * and letting someone pick a currency without one would render euros in
 * American grouping.
 */
export const CURRENCIES: CurrencyOption[] = [
  { code: "USD", label: "US dollar", locale: "en-US" },
  { code: "EUR", label: "Euro", locale: "de-DE" },
  { code: "GBP", label: "British pound", locale: "en-GB" },
  { code: "AUD", label: "Australian dollar", locale: "en-AU" },
  { code: "CAD", label: "Canadian dollar", locale: "en-CA" },
  { code: "NZD", label: "New Zealand dollar", locale: "en-NZ" },
  { code: "JPY", label: "Japanese yen", locale: "ja-JP" },
  { code: "CNY", label: "Chinese yuan", locale: "zh-CN" },
  { code: "INR", label: "Indian rupee", locale: "en-IN" },
  { code: "SGD", label: "Singapore dollar", locale: "en-SG" },
  { code: "HKD", label: "Hong Kong dollar", locale: "en-HK" },
  { code: "CHF", label: "Swiss franc", locale: "de-CH" },
  { code: "SEK", label: "Swedish krona", locale: "sv-SE" },
  { code: "NOK", label: "Norwegian krone", locale: "nb-NO" },
  { code: "DKK", label: "Danish krone", locale: "da-DK" },
  { code: "PLN", label: "Polish złoty", locale: "pl-PL" },
  { code: "CZK", label: "Czech koruna", locale: "cs-CZ" },
  { code: "ZAR", label: "South African rand", locale: "en-ZA" },
  { code: "AED", label: "UAE dirham", locale: "ar-AE" },
  { code: "BRL", label: "Brazilian real", locale: "pt-BR" },
  { code: "MXN", label: "Mexican peso", locale: "es-MX" },
  { code: "KRW", label: "South Korean won", locale: "ko-KR" },
  { code: "MYR", label: "Malaysian ringgit", locale: "ms-MY" },
  { code: "PHP", label: "Philippine peso", locale: "en-PH" },
  { code: "THB", label: "Thai baht", locale: "th-TH" },
  { code: "VND", label: "Vietnamese đồng", locale: "vi-VN" },
];

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((entry) => [entry.code, entry]));

export function currencyOption(code: string): CurrencyOption {
  return CURRENCY_BY_CODE.get(code) ?? CURRENCIES[0];
}

/* ── Appearance ─────────────────────────────────────────────────────── */

export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: "Match system",
  light: "Light",
  dark: "Dark",
};

/**
 * Accent options, each given explicitly for both surfaces rather than derived.
 *
 * A hue that carries on white is usually too dark to read on near-black, so
 * every accent names the colour it becomes in the dark theme and the text
 * colour that sits legibly on top of it.
 */
export type AccentOption = {
  id: string;
  label: string;
  light: string;
  dark: string;
  onLight: string;
  onDark: string;
};

export const ACCENTS: AccentOption[] = [
  {
    id: "emerald",
    label: "Emerald",
    light: "#059669",
    dark: "#10b981",
    onLight: "#ffffff",
    onDark: "#052e1f",
  },
  {
    id: "blue",
    label: "Blue",
    light: "#2563eb",
    dark: "#60a5fa",
    onLight: "#ffffff",
    onDark: "#0b1b3a",
  },
  {
    id: "violet",
    label: "Violet",
    light: "#7c3aed",
    dark: "#a78bfa",
    onLight: "#ffffff",
    onDark: "#1e123f",
  },
  {
    id: "amber",
    label: "Amber",
    light: "#b45309",
    dark: "#fbbf24",
    onLight: "#ffffff",
    onDark: "#3a2606",
  },
  {
    id: "rose",
    label: "Rose",
    light: "#e11d48",
    dark: "#fb7185",
    onLight: "#ffffff",
    onDark: "#3f0715",
  },
  {
    id: "teal",
    label: "Teal",
    light: "#0d9488",
    dark: "#2dd4bf",
    onLight: "#ffffff",
    onDark: "#042f2b",
  },
];

const ACCENT_BY_ID = new Map(ACCENTS.map((accent) => [accent.id, accent]));

export function accentOption(id: string): AccentOption {
  return ACCENT_BY_ID.get(id) ?? ACCENTS[0];
}

/* ── Who you are ────────────────────────────────────────────────────── */

/**
 * Gender is optional, self-described where the list falls short, and used for
 * nothing but showing the user what they told us. Pronouns are the field that
 * actually earns its place — it's what the app would have to guess otherwise,
 * and guessing is how you get it wrong.
 */
export const GENDERS = [
  "unspecified",
  "woman",
  "man",
  "non-binary",
  "self-described",
] as const;
export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = {
  unspecified: "Prefer not to say",
  woman: "Woman",
  man: "Man",
  "non-binary": "Non-binary",
  "self-described": "Let me describe it",
};

export const MAX_DISPLAY_NAME = 40;
export const MAX_GENDER_TEXT = 40;
export const MAX_PRONOUNS = 24;

/* ── Avatar ─────────────────────────────────────────────────────────── */

/**
 * A picture without an upload.
 *
 * Storing an image would mean a bucket, its own rules, and a moderation
 * question nobody asked for; a colour and a glyph give the same "that's mine"
 * recognition at a glance for a document field.
 */
export const AVATAR_COLORS = [
  "var(--series-1)",
  "var(--series-2)",
  "var(--series-3)",
  "var(--series-4)",
  "var(--series-5)",
  "var(--series-6)",
  "var(--series-7)",
  "var(--series-8)",
] as const;

export const AVATAR_EMOJI = [
  "🙂", "😎", "🦊", "🐨", "🐼", "🐧", "🦉", "🐝",
  "🌱", "🌊", "🔥", "⭐", "🌙", "🍀", "🎧", "📚",
  "⚽", "🎸", "☕", "🍜", "🚀", "🏔️", "🧊", "💎",
] as const;

/* ── The whole thing ────────────────────────────────────────────────── */

export type Preferences = {
  currency: string;
  locale: string;
  hideCents: boolean;
  theme: Theme;
  accent: string;
  avatarColor: string;
  /** null means "use the initial of your name". */
  avatarEmoji: string | null;
  displayName: string;
  gender: Gender;
  genderDescription: string;
  pronouns: string;
};

export const DEFAULT_PREFERENCES: Preferences = {
  currency: "USD",
  locale: "en-US",
  hideCents: false,
  theme: "system",
  accent: "emerald",
  avatarColor: AVATAR_COLORS[0],
  avatarEmoji: null,
  displayName: "",
  gender: "unspecified",
  genderDescription: "",
  pronouns: "",
};

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/**
 * Reads stored preferences, filling in anything absent.
 *
 * Every field is optional in the document by design: this is the same document
 * onboarding writes its flag to, and it has existed since before any of these
 * settings did. A missing field is a default, never an error.
 */
export function toPreferences(data: Record<string, unknown> | undefined): Preferences {
  if (!data) return DEFAULT_PREFERENCES;

  const currency = CURRENCY_BY_CODE.has(data.currency as string)
    ? (data.currency as string)
    : DEFAULT_PREFERENCES.currency;

  return {
    currency,
    // Stored, because someone may well want euros grouped the American way.
    locale:
      typeof data.locale === "string" && data.locale !== ""
        ? data.locale
        : currencyOption(currency).locale,
    hideCents: data.hideCents === true,
    theme: oneOf(data.theme, THEMES, DEFAULT_PREFERENCES.theme),
    accent: ACCENT_BY_ID.has(data.accent as string)
      ? (data.accent as string)
      : DEFAULT_PREFERENCES.accent,
    avatarColor: AVATAR_COLORS.includes(data.avatarColor as (typeof AVATAR_COLORS)[number])
      ? (data.avatarColor as string)
      : DEFAULT_PREFERENCES.avatarColor,
    avatarEmoji:
      typeof data.avatarEmoji === "string" && data.avatarEmoji !== ""
        ? data.avatarEmoji
        : null,
    displayName: text(data.displayName, MAX_DISPLAY_NAME),
    gender: oneOf(data.gender, GENDERS, DEFAULT_PREFERENCES.gender),
    genderDescription: text(data.genderDescription, MAX_GENDER_TEXT),
    pronouns: text(data.pronouns, MAX_PRONOUNS),
  };
}

export function subscribePreferences(
  uid: string,
  onChange: (preferences: Preferences) => void,
  onError: (error: unknown) => void,
) {
  return onSnapshot(
    profileDoc(uid),
    (snapshot) => onChange(toPreferences(snapshot.data())),
    onError,
  );
}

/** Merged, never replaced — the onboarding flag lives on this document too. */
export async function savePreferences(
  uid: string,
  patch: Partial<Preferences>,
): Promise<void> {
  await setDoc(profileDoc(uid), patch, { merge: true });
}
