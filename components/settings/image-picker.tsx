"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ImageError, toStoredImage, type ImageBudget } from "@/lib/settings/image";

/**
 * Choose a picture, or take the one you chose back off.
 *
 * The file input itself is never shown — browsers style it differently on
 * every platform and none of them match anything else here — so the visible
 * control is an ordinary button that clicks it. Downscaling happens before
 * anything is handed back, so callers only ever see something already small
 * enough to store.
 */
export function ImagePicker({
  label,
  value,
  budget,
  onChange,
  disabled = false,
}: {
  /** Names the thing being replaced, for the buttons and the screen reader. */
  label: string;
  value: string | null;
  budget: ImageBudget;
  onChange: (dataUrl: string | null) => void;
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
      onChange(await toStoredImage(file, budget));
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
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-label={label}
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || working}
        >
          <Icon name="upload" className="h-4 w-4" />
          {working ? "Processing…" : value ? "Replace" : "Upload"}
        </Button>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setError(null);
              onChange(null);
            }}
            disabled={disabled || working}
          >
            <Icon name="trash" className="h-4 w-4" />
            Remove
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-xs text-negative">
          {error}
        </p>
      ) : (
        <p className="text-xs text-muted">
          JPEG, PNG, WebP or GIF. Resized automatically — large photos are fine.
        </p>
      )}
    </div>
  );
}
