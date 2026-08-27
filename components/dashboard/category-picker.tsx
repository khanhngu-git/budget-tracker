"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import {
  CATEGORIES,
  findCategory,
  groupedCategories,
  type CategoryFlow,
} from "@/lib/budget/categories";
import { useSettings } from "@/lib/settings/settings-context";

/**
 * Choosing a category by looking at it.
 *
 * A select was fine for twelve categories and is unusable at forty: the list
 * is a scrolling column of words that hides its own contents, and on a phone
 * it becomes a native wheel with no icons at all. The grid shows every option
 * at once with the glyph that appears everywhere else in the app, so picking
 * "Petrol" is recognition rather than reading.
 */
export function CategoryPicker({
  id,
  flow,
  value,
  onChange,
  disabled = false,
  /** Categories already spoken for — shown, but marked and unselectable. */
  takenIds,
  takenNote = "Already set",
}: {
  id: string;
  flow: CategoryFlow;
  value: string;
  onChange: (categoryId: string) => void;
  disabled?: boolean;
  takenIds?: ReadonlySet<string>;
  takenNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { preferences, save } = useSettings();

  const selected = findCategory(value);
  const groups = useMemo(() => groupedCategories(flow), [flow]);

  // Starred categories are lifted into their own group at the top rather than
  // reordered in place, because moving "Groceries" out of Food & drink would
  // break the muscle memory of everyone who doesn't use favourites.
  //
  // Within that group they hold the order the full list uses, not the order
  // they were starred in: the picker is scanned by position, and a group that
  // reshuffled every time someone starred something would have to be re-read
  // from the top on every visit.
  const favouriteIds = preferences.favouriteCategories;
  const favourites = useMemo(() => {
    const starred = new Set(favouriteIds);
    return CATEGORIES.filter(
      (category) => category.flow === flow && starred.has(category.id),
    );
  }, [favouriteIds, flow]);

  function toggleFavourite(categoryId: string) {
    const next = favouriteIds.includes(categoryId)
      ? favouriteIds.filter((id) => id !== categoryId)
      : [...favouriteIds, categoryId];
    void save({ favouriteCategories: next });
  }

  const term = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      (favourites.length > 0
        ? [{ group: "Favourites" as const, categories: favourites }, ...groups]
        : groups)
        .map((entry) => ({
          ...entry,
          // The group name matches too, so "home" finds everything filed
          // under Home & bills without the user knowing each label.
          categories: entry.categories.filter(
            (category) =>
              term === "" ||
              category.label.toLowerCase().includes(term) ||
              entry.group.toLowerCase().includes(term),
          ),
        }))
        .filter((entry) => entry.categories.length > 0),
    [favourites, groups, term],
  );

  function choose(categoryId: string) {
    onChange(categoryId);
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        className="flex h-11 w-full items-center gap-2.5 rounded-lg border border-border bg-surface px-3 text-left text-[0.9375rem] text-foreground transition-colors hover:border-muted/50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-muted"
        >
          <Icon name={selected?.icon ?? "dots"} className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">
          {selected?.label ?? "Choose a category"}
        </span>
        <span className="shrink-0 text-xs font-medium text-muted">Change</span>
      </button>

      <Dialog
        open={open}
        onClose={() => {
          setOpen(false);
          setQuery("");
        }}
        size="lg"
        title={flow === "income" ? "What kind of income?" : "What was it for?"}
        description="Pick the one that fits best — you can change it later."
      >
        <div className="flex flex-col gap-4">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
            >
              <Icon name="search" className="h-4 w-4" />
            </span>
            <TextInput
              autoFocus
              type="search"
              aria-label="Search categories"
              placeholder="Search categories"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="pl-9"
            />
          </div>

          <div className="-mx-1 max-h-[55dvh] overflow-y-auto px-1">
            {matches.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">
                Nothing matches “{query.trim()}”.
              </p>
            ) : (
              <div className="flex flex-col gap-5">
                {matches.map((entry) => (
                  <section key={entry.group} className="flex flex-col gap-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {entry.group}
                    </h3>
                    <div
                      role="radiogroup"
                      aria-label={entry.group}
                      className="grid grid-cols-2 gap-2 sm:grid-cols-3"
                    >
                      {entry.categories.map((category) => {
                        const current = category.id === value;
                        const taken =
                          takenIds?.has(category.id) === true && !current;

                        const starred = favouriteIds.includes(category.id);

                        // The star is its own control, so the tile stays a
                        // single radio rather than a button containing one.
                        return (
                          <div
                            key={`${entry.group}-${category.id}`}
                            className={`relative flex items-center rounded-xl border transition-colors ${
                              current
                                ? "border-accent bg-accent/10"
                                : taken
                                  ? "border-border opacity-45"
                                  : "border-border hover:border-muted/50 hover:bg-surface-muted"
                            }`}
                          >
                            <button
                              type="button"
                              role="radio"
                              aria-checked={current}
                              disabled={taken}
                              title={taken ? takenNote : undefined}
                              onClick={() => choose(category.id)}
                              className="flex min-w-0 flex-1 items-center gap-2.5 p-2.5 text-left disabled:cursor-not-allowed"
                            >
                              <span
                                aria-hidden
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                                  current
                                    ? "bg-accent text-accent-foreground"
                                    : "bg-surface-muted text-muted"
                                }`}
                              >
                                <Icon name={category.icon} className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-medium text-foreground">
                                  {category.label}
                                </span>
                                {taken ? (
                                  <span className="block truncate text-xs text-muted">
                                    {takenNote}
                                  </span>
                                ) : null}
                              </span>
                              {current ? (
                                <Icon
                                  name="check"
                                  className="h-4 w-4 shrink-0 text-accent"
                                />
                              ) : null}
                            </button>

                            <button
                              type="button"
                              aria-pressed={starred}
                              aria-label={
                                starred
                                  ? `Remove ${category.label} from favourites`
                                  : `Add ${category.label} to favourites`
                              }
                              onClick={() => toggleFavourite(category.id)}
                              className={`mr-1.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
                                starred
                                  ? "text-warning"
                                  : "text-muted/40 hover:bg-surface-muted hover:text-muted"
                              }`}
                            >
                              <Icon
                                name="star"
                                className={`h-4 w-4 ${starred ? "fill-current" : ""}`}
                              />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </div>
        </div>
      </Dialog>
    </>
  );
}
