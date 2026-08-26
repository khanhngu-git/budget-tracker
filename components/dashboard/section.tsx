import type { ReactNode } from "react";

/**
 * A titled band of the page.
 *
 * `divided` draws the hairline that separates one band from the next — the
 * cards inside a band already carry borders, so the only thing that tells a
 * reader where "accounts" stops and "this month" starts is the rule and the
 * extra air above it.
 */
export function Section({
  title,
  subtitle,
  action,
  divided = false,
  children,
}: {
  title: string;
  /** Takes a node, not just text, so a figure inside it can carry a tone. */
  subtitle?: ReactNode;
  action?: ReactNode;
  divided?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-4 ${
        divided ? "border-t border-border pt-8" : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-[0.9375rem] font-semibold tracking-tight text-foreground">
            {title}
          </h2>
          {subtitle ? <p className="text-sm text-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {children}
    </section>
  );
}
