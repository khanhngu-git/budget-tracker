import { Icon } from "@/components/ui/icon";
import type { Preferences } from "@/lib/settings/preferences";

const SIZES = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-20 w-20",
} as const;

const GLYPHS = {
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
} as const;

/**
 * The user's picture, or a plain stand-in for it.
 *
 * Two states, not four. A photo if there is one; otherwise a neutral person
 * glyph — the thing every other product uses for exactly this, and which reads
 * instantly as "no picture yet" rather than as a deliberate choice. The colour
 * swatches and emoji that used to live here dressed up an empty state as a
 * decision, and made "change your picture" a menu of thirty options when the
 * only one people wanted was "use mine".
 */
export function Avatar({
  preferences,
  size = "md",
}: {
  preferences: Preferences;
  size?: keyof typeof SIZES;
}) {
  if (preferences.avatarImage) {
    // Plain <img>: the source is a data URL already sized by us, so there is
    // nothing for the image optimiser to fetch or resize.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={preferences.avatarImage}
        alt=""
        aria-hidden
        className={`shrink-0 rounded-full object-cover ${SIZES[size]}`}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full bg-surface-muted text-muted ${SIZES[size]}`}
    >
      <Icon name="user" className={GLYPHS[size]} />
    </span>
  );
}
