"use client";

import { useState } from "react";
import { updateProfile } from "firebase/auth";
import { AvatarPicker } from "@/components/settings/avatar-picker";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/lib/auth/auth-context";
import { useSettings } from "@/lib/settings/settings-context";
import {
  GENDERS,
  GENDER_LABELS,
  MAX_DISPLAY_NAME,
  MAX_GENDER_TEXT,
  MAX_PRONOUNS,
  type Gender,
  type Preferences,
} from "@/lib/settings/preferences";

/**
 * Who the app thinks you are.
 *
 * Saved as one form rather than field by field, because these answers are
 * written rather than picked — autosaving a half-typed name is how you end up
 * with "Kh" on your own dashboard.
 */
export function ProfileSettings() {
  const { user } = useAuth();
  const { preferences, save } = useSettings();

  const [draft, setDraft] = useState<Preferences>(preferences);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function edit(patch: Partial<Preferences>) {
    setSaved(false);
    setError(null);
    setDraft((current) => ({ ...current, ...patch }));
  }

  const dirty =
    draft.displayName !== preferences.displayName ||
    draft.gender !== preferences.gender ||
    draft.genderDescription !== preferences.genderDescription ||
    draft.pronouns !== preferences.pronouns ||
    draft.avatarImage !== preferences.avatarImage;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const displayName = draft.displayName.trim().slice(0, MAX_DISPLAY_NAME);
      await save({
        displayName,
        // The free-text description is only meaningful next to the option that
        // asks for it; keeping it otherwise would resurrect it later.
        gender: draft.gender,
        genderDescription:
          draft.gender === "self-described"
            ? draft.genderDescription.trim().slice(0, MAX_GENDER_TEXT)
            : "",
        pronouns: draft.pronouns.trim().slice(0, MAX_PRONOUNS),
        avatarImage: draft.avatarImage,
      });

      // Firebase Auth keeps its own copy, and it's the one that survives into
      // anything that reads the session rather than the profile document.
      if (user && displayName && user.displayName !== displayName) {
        await updateProfile(user, { displayName });
      }
      setSaved(true);
    } catch {
      setError("Couldn't save your profile. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-2xl border border-border bg-surface p-6"
    >
      <div className="flex items-center gap-4">
        <AvatarPicker preferences={draft} onChange={edit} disabled={pending} />
        <div className="flex min-w-0 flex-col items-start gap-1">
          <p className="truncate text-[0.9375rem] font-medium text-foreground">
            {draft.displayName.trim() || "No name set"}
          </p>
          <p className="truncate text-sm text-muted">{user?.email}</p>
        </div>
      </div>

      <Field label="Name" htmlFor="display-name" hint="What we call you.">
        <TextInput
          id="display-name"
          value={draft.displayName}
          maxLength={MAX_DISPLAY_NAME}
          placeholder="Your name"
          onChange={(event) => edit({ displayName: event.target.value })}
          disabled={pending}
        />
      </Field>

      <Field
        label="Pronouns"
        htmlFor="pronouns"
        hint="Optional. Left blank, nothing is assumed."
      >
        <TextInput
          id="pronouns"
          value={draft.pronouns}
          maxLength={MAX_PRONOUNS}
          placeholder="they/them"
          onChange={(event) => edit({ pronouns: event.target.value })}
          disabled={pending}
        />
      </Field>

      <Field label="Gender" htmlFor="gender" hint="Optional, and yours alone.">
        <Select
          id="gender"
          value={draft.gender}
          options={GENDERS.map((gender) => ({
            value: gender,
            label: GENDER_LABELS[gender],
          }))}
          onChange={(gender) => edit({ gender: gender as Gender })}
          disabled={pending}
        />
      </Field>

      {draft.gender === "self-described" ? (
        <Field label="In your words" htmlFor="gender-description">
          <TextInput
            id="gender-description"
            value={draft.genderDescription}
            maxLength={MAX_GENDER_TEXT}
            onChange={(event) => edit({ genderDescription: event.target.value })}
            disabled={pending}
          />
        </Field>
      ) : null}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-3">
        {saved && !dirty ? (
          <span className="text-sm text-muted">Saved.</span>
        ) : null}
        <Button type="submit" disabled={pending || !dirty}>
          {pending ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
