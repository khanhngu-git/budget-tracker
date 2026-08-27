"use client";

import { Section } from "@/components/dashboard/section";
import { AppearanceSettings } from "@/components/settings/appearance-settings";
import { DangerZone } from "@/components/settings/danger-zone";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { useSettings } from "@/lib/settings/settings-context";

/**
 * Everything that isn't a number.
 *
 * Four bands, in the order someone actually looks for them: who you are, how
 * the app looks, how you get in, and — last, behind its own border — the two
 * things that throw it all away. The accounts list that used to sit here is
 * gone: it was a read-only copy of the Overview's cards, which is where you
 * can now actually rename, correct and remove them.
 *
 * The headings carry no explanatory line. "Appearance" does not need to be
 * told to the reader twice, and a subtitle under every one of them was four
 * sentences of scenery between the user and the controls.
 */
export default function SettingsPage() {
  const { ready } = useSettings();

  const loading = (
    <p className="rounded-2xl border border-dashed border-border bg-surface px-5 py-6 text-sm text-muted">
      Loading…
    </p>
  );

  return (
    <>
      <Section title="Your profile">
        {ready ? <ProfileSettings /> : loading}
      </Section>

      <Section divided title="Appearance">
        {ready ? <AppearanceSettings /> : loading}
      </Section>

      <Section divided title="Data and privacy">
        <SecuritySettings />
      </Section>

      <Section divided title="Danger zone">
        <DangerZone />
      </Section>
    </>
  );
}
