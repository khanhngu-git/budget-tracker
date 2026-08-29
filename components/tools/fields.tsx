"use client";

import { Field, TextInput } from "@/components/ui/field";
import { currencySymbol } from "@/lib/budget/format";

/**
 * The inputs a calculator is made of.
 *
 * Kept as their own components because a calculator is almost entirely fields:
 * two of them share the same five shapes, and writing the symbol, the input
 * mode and the affix out twice is how the two forms drift apart.
 *
 * All three are strings all the way through. Parsing on every keystroke and
 * storing a number would fight the user over "1.", "0.0" and an empty box —
 * the parse belongs at the point the figure is used, not at the point it's
 * typed.
 */

function Affixed({
  prefix,
  suffix,
  children,
}: {
  prefix?: string;
  suffix?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      {prefix ? (
        <span
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted"
        >
          {prefix}
        </span>
      ) : null}
      {children}
      {suffix ? (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted"
        >
          {suffix}
        </span>
      ) : null}
    </div>
  );
}

export function MoneyField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const symbol = currencySymbol();
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Affixed prefix={symbol}>
        <TextInput
          id={id}
          inputMode="decimal"
          placeholder="0.00"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ paddingLeft: `${symbol.length * 0.55 + 1.25}rem` }}
        />
      </Affixed>
    </Field>
  );
}

export function PercentField({
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Affixed suffix="%">
        <TextInput
          id={id}
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="pr-8"
        />
      </Affixed>
    </Field>
  );
}

export function CountField({
  id,
  label,
  hint,
  unit,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  /** "years", "months" — the word that would otherwise be in the label. */
  unit: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <Affixed suffix={unit}>
        <TextInput
          id={id}
          inputMode="numeric"
          placeholder="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          style={{ paddingRight: `${unit.length * 0.55 + 1.25}rem` }}
        />
      </Affixed>
    </Field>
  );
}

/** A figure worth reading on its own, under the word for what it is. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "muted";
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted">{label}</span>
      <span
        className={`text-lg font-semibold tabular-nums tracking-tight ${
          tone === "positive"
            ? "text-positive"
            : tone === "muted"
              ? "text-muted"
              : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
