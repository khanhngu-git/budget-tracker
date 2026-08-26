"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/lib/auth/auth-context";
import { setMoneyFormat } from "@/lib/budget/format";
import {
  DEFAULT_PREFERENCES,
  accentOption,
  savePreferences,
  subscribePreferences,
  type Preferences,
} from "./preferences";

type SettingsContextValue = {
  preferences: Preferences;
  /** False until the stored preferences have actually arrived. */
  ready: boolean;
  save: (patch: Partial<Preferences>) => Promise<void>;
  /** Changes whenever money would be written differently. */
  formatKey: string;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

/**
 * Applies the accent to the document, as a pair of variables the whole token
 * system already reads.
 *
 * Every accented surface in the app resolves `--accent`, so overriding it on
 * the root element is the entire mechanism — no component knows an accent is
 * configurable, and none has to.
 */
function applyAppearance(preferences: Preferences, dark: boolean) {
  const root = document.documentElement;
  const accent = accentOption(preferences.accent);

  if (preferences.theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", preferences.theme);

  root.style.setProperty("--accent", dark ? accent.dark : accent.light);
  root.style.setProperty(
    "--accent-foreground",
    dark ? accent.onDark : accent.onLight,
  );
}

/**
 * Holds the user's preferences and makes them true of the page.
 *
 * Two of them can't be handled by passing a prop: money formatting is called
 * from analytics sentences and chart tooltips that have no React context, and
 * the theme is a document-level attribute. Both are set from here — the one
 * place that knows what the user chose — so nothing downstream has to.
 */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user?.uid ?? null;

  const [state, setState] = useState<{ key: string; value: Preferences }>({
    key: "",
    value: DEFAULT_PREFERENCES,
  });

  useEffect(() => {
    if (!uid) return;
    return subscribePreferences(
      uid,
      (next) => setState({ key: uid, value: next }),
      // Preferences are taste, not data: a read that fails should leave the
      // user with the defaults, never with an app they can't use.
      () => setState({ key: uid, value: DEFAULT_PREFERENCES }),
    );
  }, [uid]);

  const ready = uid !== null && state.key === uid;
  const preferences = ready ? state.value : DEFAULT_PREFERENCES;

  // Set during render, not in an effect: children formatting money below this
  // point must already see the right currency on their first pass, or every
  // amount in the app would render once in dollars and then correct itself.
  setMoneyFormat({
    currency: preferences.currency,
    locale: preferences.locale,
    hideCents: preferences.hideCents,
  });

  // Whether the *resolved* theme is dark, which for "system" only the browser
  // knows — and can change under us while the app is open.
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const dark =
    preferences.theme === "dark" ||
    (preferences.theme === "system" && systemDark);

  useEffect(() => {
    applyAppearance(preferences, dark);
  }, [preferences, dark]);

  const save = useCallback(
    async (patch: Partial<Preferences>) => {
      if (!uid) return;
      await savePreferences(uid, patch);
    },
    [uid],
  );

  const value = useMemo(
    () => ({
      preferences,
      ready,
      save,
      formatKey: `${preferences.currency}:${preferences.locale}:${preferences.hideCents}`,
    }),
    [preferences, ready, save],
  );

  return (
    <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const value = useContext(SettingsContext);
  if (!value) {
    throw new Error("useSettings must be used inside <SettingsProvider>.");
  }
  return value;
}
