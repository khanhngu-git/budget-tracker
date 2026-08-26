import type { Preferences } from "@/lib/settings/preferences";

const SIZES = {
  sm: "h-8 w-8 text-sm",
  md: "h-12 w-12 text-xl",
  lg: "h-20 w-20 text-4xl",
} as const;

/**
 * The user's picture, without there being a picture.
 *
 * Falls back to the first letter of whatever we can call them, so an account
 * that has never opened Settings still gets something recognisable rather than
 * a grey circle.
 */
export function Avatar({
  preferences,
  fallback,
  size = "md",
}: {
  preferences: Preferences;
  /** Used for the initial — the display name, or failing that the email. */
  fallback: string;
  size?: keyof typeof SIZES;
}) {
  const initial = (preferences.displayName || fallback || "?")
    .trim()
    .charAt(0)
    .toUpperCase();

  return (
    <span
      aria-hidden
      className={`flex shrink-0 select-none items-center justify-center rounded-full font-semibold ${SIZES[size]}`}
      style={{
        color: preferences.avatarColor,
        backgroundColor: `color-mix(in oklab, ${preferences.avatarColor} 18%, var(--surface))`,
      }}
    >
      {preferences.avatarEmoji ?? initial}
    </span>
  );
}
