"use client";

import { useRef, useState } from "react";
import { Avatar } from "@/components/settings/avatar";
import { Icon } from "@/components/ui/icon";
import { IMAGE_LIMITS, type Preferences } from "@/lib/settings/preferences";
import { ImageError, toStoredImage } from "@/lib/settings/image";

/**
 * The picture, and the two things you can do to it, on the picture itself.
 *
 * There is no dialog and no "Change picture" button beside it: the avatar *is*
 * the control. Hovering (or focusing) reveals an upload glyph over it, and a
 * picture that exists gets a small remove affordance in the corner. That is the
 * pattern people already know from every other profile page, and it costs the
 * settings form neither a button nor a modal.
 */
export function AvatarPicker({
  preferences,
  onChange,
  disabled = false,
}: {
  preferences: Preferences;
  onChange: (patch: Partial<Preferences>) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setWorking(true);
    try {
      onChange({ avatarImage: await toStoredImage(file, IMAGE_LIMITS.avatar) });
    } catch (caught) {
      setError(
        caught instanceof ImageError
          ? caught.message
          : "That image couldn't be used. Try another.",
      );
    } finally {
      setWorking(false);
      // Cleared so picking the same file twice in a row still fires a change.
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-20 w-20 shrink-0">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          aria-label="Upload a profile picture"
          onChange={(event) => void handleFile(event.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || working}
          aria-label={
            preferences.avatarImage
              ? "Replace your profile picture"
              : "Upload a profile picture"
          }
          className="group relative block h-20 w-20 overflow-hidden rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed"
        >
          <Avatar preferences={preferences} size="lg" />

          {/* Revealed on hover and on keyboard focus alike — a control that
              only exists under a pointer is a control half the users never
              find. */}
          <span
            aria-hidden
            className={`absolute inset-0 flex items-center justify-center rounded-full bg-black/55 text-white transition-opacity ${
              working
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
            }`}
          >
            <Icon name="upload" className="h-6 w-6" />
          </span>
        </button>

        {preferences.avatarImage && !working ? (
          <button
            type="button"
            onClick={() => {
              setError(null);
              onChange({ avatarImage: null });
            }}
            disabled={disabled}
            aria-label="Remove your profile picture"
            className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:text-negative"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="max-w-[16rem] text-xs text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
