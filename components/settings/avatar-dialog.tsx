"use client";

import { Avatar } from "@/components/settings/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  AVATAR_COLORS,
  AVATAR_EMOJI,
  type Preferences,
} from "@/lib/settings/preferences";

/**
 * Picking a picture, out of the way.
 *
 * Thirty-odd swatches and symbols laid out on the settings page turn a
 * one-off decision into the loudest thing on it — and it sits directly above
 * the fields people actually came to edit. Behind a button, the choice is made
 * once and the page goes back to being about your name.
 *
 * Changes land on the caller's draft immediately so the preview is live; the
 * form's own Save is still what writes them.
 */
export function AvatarDialog({
  preferences,
  fallback,
  onChange,
  open,
  onClose,
}: {
  preferences: Preferences;
  /** For the initial, when no symbol is chosen. */
  fallback: string;
  onChange: (patch: Partial<Preferences>) => void;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Your picture"
      description="A colour and a symbol — or just the first letter of your name."
    >
      <div className="flex flex-col gap-5">
        <div className="flex justify-center">
          <Avatar preferences={preferences} fallback={fallback} size="lg" />
        </div>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-sm font-medium text-foreground">Colour</legend>
          <div
            role="radiogroup"
            aria-label="Avatar colour"
            className="flex flex-wrap gap-2"
          >
            {AVATAR_COLORS.map((color, index) => (
              <button
                key={color}
                type="button"
                role="radio"
                aria-checked={preferences.avatarColor === color}
                aria-label={`Colour ${index + 1}`}
                onClick={() => onChange({ avatarColor: color })}
                className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                  preferences.avatarColor === color
                    ? "border-foreground"
                    : "border-transparent"
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2.5">
          <legend className="text-sm font-medium text-foreground">Symbol</legend>
          <div
            role="radiogroup"
            aria-label="Avatar symbol"
            className="flex flex-wrap gap-1.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={preferences.avatarEmoji === null}
              onClick={() => onChange({ avatarEmoji: null })}
              className={`h-10 rounded-lg border px-3 text-xs font-medium transition-colors ${
                preferences.avatarEmoji === null
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              My initial
            </button>
            {AVATAR_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                role="radio"
                aria-checked={preferences.avatarEmoji === emoji}
                aria-label={`Use ${emoji}`}
                onClick={() => onChange({ avatarEmoji: emoji })}
                className={`h-10 w-10 rounded-lg border text-lg leading-none transition-colors ${
                  preferences.avatarEmoji === emoji
                    ? "border-accent bg-accent/10"
                    : "border-border hover:bg-surface-muted"
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="flex justify-end">
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
