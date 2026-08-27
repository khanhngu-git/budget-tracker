"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon, type IconName } from "@/components/ui/icon";

/**
 * A dropdown the app actually owns.
 *
 * A native `<select>` renders its list with the operating system, which means
 * square corners and a solid blue selection bar on every platform — neither of
 * which any amount of CSS can reach. So the list is drawn here instead: rounded
 * like every other surface in the app, and marking the current choice with an
 * outline and a tick rather than a filled highlight, so the option's own text
 * stays readable and the accent colour the user picked is the only colour in
 * play.
 *
 * Everything a native select gives away for free has to be paid for by hand —
 * the roving focus, type-ahead, Escape, the outside click — which is why it all
 * lives in this one component rather than being reimplemented per dropdown.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Optional heading this option sits under. Order of first appearance wins. */
  group?: string;
  icon?: IconName;
  disabled?: boolean;
};

export function Select({
  id,
  options,
  value,
  onChange,
  disabled,
  placeholder = "Select…",
  className = "",
  "aria-label": ariaLabel,
}: {
  id?: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  "aria-label"?: string;
}) {
  const generatedId = useId();
  const listId = `${id ?? generatedId}-listbox`;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Opening upward when there isn't room below — a dropdown that renders off
  // the bottom of a dialog is simply unusable.
  const [dropUp, setDropUp] = useState(false);

  const selectable = useMemo(
    () => options.filter((option) => !option.disabled),
    [options],
  );
  const selected = options.find((option) => option.value === value) ?? null;

  /** Options in render order, with each group's heading emitted once. */
  const rendered = useMemo(() => {
    const seen = new Set<string>();
    const rows: ({ kind: "heading"; label: string } | { kind: "option"; option: SelectOption })[] = [];
    for (const option of options) {
      if (option.group && !seen.has(option.group)) {
        seen.add(option.group);
        rows.push({ kind: "heading", label: option.group });
      }
      rows.push({ kind: "option", option });
    }
    // A single group is just a list — the heading tells the reader nothing.
    return seen.size > 1 ? rows : rows.filter((row) => row.kind === "option");
  }, [options]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  const commit = useCallback(
    (option: SelectOption) => {
      if (option.disabled) return;
      onChange(option.value);
      close();
      triggerRef.current?.focus();
    },
    [onChange, close],
  );

  /* Open with the current choice under the cursor, so Enter is a no-op rather
     than a surprise. */
  function openList() {
    if (disabled) return;
    const index = selectable.findIndex((option) => option.value === value);
    setActiveIndex(index === -1 ? 0 : index);
    setOpen(true);
  }

  // Down is the default and the expectation; flipping up is a last resort for
  // a trigger genuinely near the bottom of the viewport. The old threshold
  // asked for a full 260px below, which most fields inside a dialog don't
  // have — so lists that had plenty of room still opened upwards. Now the list
  // shrinks to the space available first, and only flips when up is clearly
  // roomier and down is unusable.
  const [maxHeight, setMaxHeight] = useState(256);
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flip = below < 140 && above > below;
    setDropUp(flip);
    setMaxHeight(Math.max(140, Math.min(256, flip ? above : below)));
  }, [open]);

  /* Dismissal: a click anywhere else, or the page moving under the list. */
  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) close();
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, close]);

  /* Keep the active option in view when arrowing past the fold. */
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    listRef.current
      ?.querySelector(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  /* Type-ahead, the one affordance people miss most from a native select. */
  const typed = useRef({ text: "", at: 0 });
  function onTypeAhead(key: string) {
    const now = Date.now();
    typed.current.text = now - typed.current.at > 700 ? key : typed.current.text + key;
    typed.current.at = now;
    const match = selectable.findIndex((option) =>
      option.label.toLowerCase().startsWith(typed.current.text.toLowerCase()),
    );
    if (match === -1) return;
    if (open) setActiveIndex(match);
    else commit(selectable[match]);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (disabled) return;

    if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
      return;
    }

    if (!open) {
      if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        openList();
      } else if (event.key.length === 1) {
        event.preventDefault();
        onTypeAhead(event.key);
      }
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, selectable.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(selectable.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        if (selectable[activeIndex]) commit(selectable[activeIndex]);
        break;
      case "Tab":
        close();
        break;
      default:
        if (event.key.length === 1) {
          event.preventDefault();
          onTypeAhead(event.key);
        }
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-border bg-surface px-3 text-left text-[0.9375rem] text-foreground transition-colors hover:border-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex min-w-0 items-center gap-2">
          {selected?.icon ? (
            <Icon name={selected.icon} className="h-4 w-4 shrink-0 text-muted" />
          ) : null}
          <span className={`truncate ${selected ? "" : "text-muted/70"}`}>
            {selected?.label ?? placeholder}
          </span>
        </span>
        {/* One glyph, turned: down when the list is closed, up when it's open. */}
        <Icon
          name="chevronRight"
          className={`h-4 w-4 shrink-0 text-muted transition-transform ${
            open ? "-rotate-90" : "rotate-90"
          }`}
        />
      </button>

      {open ? (
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined
          }
          tabIndex={-1}
          onKeyDown={onKeyDown}
          style={{ maxHeight }}
          className={`absolute z-50 w-full overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg ${
            dropUp ? "bottom-full mb-1" : "top-full mt-1"
          }`}
        >
          {rendered.map((row, rowIndex) => {
            if (row.kind === "heading") {
              return (
                <p
                  key={`h-${row.label}-${rowIndex}`}
                  role="presentation"
                  className="px-2.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted"
                >
                  {row.label}
                </p>
              );
            }

            const option = row.option;
            const index = selectable.indexOf(option);
            const isSelected = option.value === value;
            const isActive = index === activeIndex;

            return (
              <div
                key={option.value}
                id={`${listId}-${index}`}
                data-index={index}
                role="option"
                aria-selected={isSelected}
                aria-disabled={option.disabled || undefined}
                onMouseEnter={() => !option.disabled && setActiveIndex(index)}
                onClick={() => commit(option)}
                // The current choice is marked with an outline and a tick, not
                // a filled bar: the label keeps its own colour, and the ring
                // reads the same in light and dark without a second palette.
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  option.disabled
                    ? "cursor-not-allowed text-muted/60"
                    : "text-foreground"
                } ${isActive && !option.disabled ? "bg-surface-muted" : ""} ${
                  isSelected
                    ? "outline outline-2 -outline-offset-2 outline-accent"
                    : ""
                }`}
              >
                {option.icon ? (
                  <Icon name={option.icon} className="h-4 w-4 shrink-0 text-muted" />
                ) : null}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected ? (
                  <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
