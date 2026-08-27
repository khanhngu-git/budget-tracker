"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/budget/format";

/**
 * An amount that counts up to itself when it first appears.
 *
 * The point is not decoration — it's that the eye is drawn to a number that
 * moves, so the balances announce themselves on arrival instead of being one
 * more thing on a page of static text. It runs again whenever the figure
 * changes, counting from where it was, so the size of a change is visible
 * rather than merely its result.
 *
 * Counting is done on the *cents* and formatted every frame, so the currency,
 * grouping and rounding are exactly what `formatMoney` would have produced
 * standing still.
 */

/** Fast at first, settling at the end — a linear count reads mechanical. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

const DURATION = 650;

export function AnimatedMoney({
  cents,
  compact = false,
  className = "",
}: {
  cents: number;
  compact?: boolean;
  className?: string;
}) {
  // Starts at zero so the first paint is the beginning of the count rather
  // than its result — which is also why no effect has to set it.
  const [shown, setShown] = useState(0);

  // Where the running tween started and where it is heading. Refs, so a
  // re-render mid-flight can't restart it from the current frame.
  const from = useRef(0);
  const target = useRef(cents);
  const latest = useRef(0);

  useEffect(() => {
    if (target.current === cents && latest.current === cents) return;

    from.current = latest.current;
    target.current = cents;

    // Anyone who has asked for less motion still gets a frame, just not a
    // journey — so the value only ever changes inside the loop below.
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? 0
      : DURATION;
    const start = performance.now();
    const distance = cents - from.current;
    let frame = 0;

    const step = (now: number) => {
      const progress = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const next = Math.round(from.current + distance * easeOut(progress));
      latest.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [cents]);

  return (
    <span className={`tabular-nums ${className}`}>
      {formatMoney(shown, { compact })}
    </span>
  );
}
