"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Thin wrapper over the native <dialog>, which gives us modal semantics,
 * Escape-to-close, and focus handling without hand-rolling a focus trap.
 */
const WIDTHS = {
  md: "max-w-md",
  lg: "max-w-2xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** "lg" for a dialog whose content is a grid rather than a column of fields. */
  size?: keyof typeof WIDTHS;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // showModal() parks focus on the first tabbable control — the "Expense"
      // and "Earn" tabs — and the browser treats that as keyboard focus, so
      // the dialog opened with an accent ring drawn around a tab nobody had
      // touched. Focus the dialog itself instead: the reader still lands
      // inside, Tab still walks the form from the top, and nothing is
      // highlighted as if it were chosen.
      dialog.focus({ preventScroll: true });
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Focusable on purpose (see the effect), never tab-reachable.
      tabIndex={-1}
      // `close` doesn't bubble in the DOM, but React replays it up the
      // component tree anyway — so a dialog opened *inside* this one (the
      // category picker inside the entry form) closing itself would otherwise
      // close its parent too, and picking a category would dismiss the form
      // before the choice could be saved. Only act on our own close.
      onClose={(event) => {
        if (event.target === ref.current) onClose();
      }}
      onClick={(event) => {
        // Clicks on the backdrop are reported against the dialog element itself.
        if (event.target === ref.current) onClose();
      }}
      className={`m-auto max-h-[calc(100dvh-3rem)] w-[calc(100%-2rem)] ${WIDTHS[size]} rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/55`}
    >
      {open ? (
        <div className="flex flex-col gap-5 p-6">
          <header className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h2>
            {description ? (
              <p className="text-sm text-muted">{description}</p>
            ) : null}
          </header>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
