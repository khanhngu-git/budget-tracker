import type { ComponentProps, ReactNode } from "react";

export const inputClasses =
  "h-11 w-full rounded-lg border border-border bg-surface px-3 text-[0.9375rem] text-foreground transition-colors placeholder:text-muted/70 hover:border-muted/50 disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${inputClasses} ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${inputClasses} ${className}`} {...props} />;
}
