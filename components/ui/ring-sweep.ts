"use client";

import { useEffect, useState, type CSSProperties } from "react";

/**
 * One clockwise sweep, shared by every ring in the app.
 *
 * Both donuts used to animate on their own terms: the allocation ring on the
 * Overview swept segment by segment, while the expense ring on Statistics grew
 * all of its slices at once. Two charts of the same shape moving in two
 * different ways is a difference the reader has to notice and then explain to
 * themselves — so the motion lives here, and both import it.
 *
 * The mechanism is one hand travelling round the dial. Every arc is drawn from
 * a dash of zero to its full length, but each waits for the arcs before it to
 * finish, and each takes time in proportion to how much of the circle it
 * covers. A quarter-slice takes a quarter of the sweep; the pen never lifts
 * and never changes speed, which is why the easing is linear — anything else
 * would decelerate into each boundary and read as several separate animations
 * rather than one pass.
 */

/** How long one full turn takes, however many slices share it. */
export const SWEEP_MS = 900;

/** Hover feedback is a different question, and answers it immediately. */
const HOVER_MS = 150;

/**
 * The transition, written once.
 *
 * The property order here is load-bearing: `sweepStyle` supplies three
 * durations and three delays positionally, so the list must stay in step with
 * it. Kept as a string constant so both rings resolve the same class rather
 * than two literals that could drift apart.
 */
export const SWEEP_CLASS =
  "transition-[stroke-dasharray,stroke-width,opacity] ease-linear motion-reduce:transition-none";

/**
 * @param fraction how much of the ring this arc covers, 0–1
 * @param startsAt where it begins, as a fraction of the ring — which is also
 *   how long it waits, since the arcs before it occupy exactly that much sweep
 */
export function sweepStyle(fraction: number, startsAt: number): CSSProperties {
  return {
    transitionDuration: `${fraction * SWEEP_MS}ms, ${HOVER_MS}ms, ${HOVER_MS}ms`,
    transitionDelay: `${startsAt * SWEEP_MS}ms, 0ms, 0ms`,
  };
}

/**
 * False on the first frame, true on the next — the two states the sweep runs
 * between.
 *
 * Reduced motion needs no branch anywhere: the transition is switched off in
 * CSS, so this same change lands the ring fully drawn on the frame it arrives.
 */
export function useSweep(): boolean {
  const [swept, setSwept] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setSwept(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return swept;
}
