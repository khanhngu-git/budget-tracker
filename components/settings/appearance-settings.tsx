"use client";

import { useState } from "react";
import { Field, Select } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { formatMoney } from "@/lib/budget/format";
import {
  ACCENTS,
  CURRENCIES,
  THEMES,
  THEME_LABELS,
  currencyOption,
  type Theme,
} from "@/lib/settings/preferences";
import { useSettings } from "@/lib/settings/settings-context";

const THEME_ICONS: Record<Theme, IconName> = {
  system: "monitor",
  light: "sun",
  dark: "moon",
};

/**
 * Appearance and money formatting, saved the moment they're chosen.
 *
 * Unlike a name, every control here shows its own result — the page changes
 * colour, the sample amount re-renders — so a Save button would only be asking
 * the user to confirm something they can already see.
 */
export function AppearanceSettings() {
  const { preferences, save } = useSettings();
  const [error, setError] = useState<string | null>(null);

  function apply(patch: Parameters<typeof save>[0]) {
    setError(null);
    save(patch).catch(() =>
      setError("Couldn't save that. Please try again."),
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-2xl border border-border bg-surface p-6">
      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium text-foreground">Theme</legend>
        <div
          role="radiogroup"
          aria-label="Theme"
          className="grid grid-cols-3 gap-2"
        >
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={preferences.theme === theme}
              onClick={() => apply({ theme })}
              className={`inline-flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs font-medium transition-colors ${
                preferences.theme === theme
                  ? "border-accent bg-accent/10 text-foreground"
                  : "border-border text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon name={THEME_ICONS[theme]} className="h-5 w-5" />
              {THEME_LABELS[theme]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="text-sm font-medium text-foreground">Accent</legend>
        <p className="text-xs text-muted">
          Used for buttons, focus rings and anything the app wants you to notice.
        </p>
        <div
          role="radiogroup"
          aria-label="Accent colour"
          className="flex flex-wrap gap-2"
        >
          {ACCENTS.map((accent) => (
            <button
              key={accent.id}
              type="button"
              role="radio"
              aria-checked={preferences.accent === accent.id}
              aria-label={accent.label}
              title={accent.label}
              onClick={() => apply({ accent: accent.id })}
              className={`h-9 w-9 rounded-full border-2 transition-transform hover:scale-105 ${
                preferences.accent === accent.id
                  ? "border-foreground"
                  : "border-transparent"
              }`}
              // The swatch shows the light value even in dark mode, because it
              // is naming a choice, not previewing a surface.
              style={{ backgroundColor: accent.light }}
            />
          ))}
        </div>
      </fieldset>

      <Field
        label="Currency"
        htmlFor="currency"
        hint={`Every amount in the app, written this way: ${formatMoney(123456)}`}
      >
        <Select
          id="currency"
          value={preferences.currency}
          onChange={(event) => {
            const next = currencyOption(event.target.value);
            // The locale travels with the currency: euros grouped the American
            // way would be nobody's idea of euros.
            apply({ currency: next.code, locale: next.locale });
          }}
        >
          {CURRENCIES.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.label} ({currency.code})
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={preferences.hideCents}
          onChange={(event) => apply({ hideCents: event.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium text-foreground">
            Round to whole amounts
          </span>
          <span className="text-sm text-muted">
            Hides the cents on screen. Nothing is rounded in your data — it is
            still stored and totalled to the cent.
          </span>
        </span>
      </label>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
