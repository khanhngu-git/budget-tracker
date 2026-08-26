import type { ReactNode } from "react";

/**
 * One hand-authored outline set, drawn on a 24px grid at a single stroke
 * weight so category glyphs, account glyphs and UI affordances all sit at the
 * same visual weight. Everything inherits `currentColor`, so an icon takes the
 * colour of whatever text it sits beside.
 */
const PATHS = {
  // Income
  banknote: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="2.5" />
    </>
  ),
  laptop: (
    <>
      <rect x="4" y="5" width="16" height="11" rx="1.5" />
      <path d="M2 19.5h20" />
    </>
  ),
  undo: (
    <>
      <path d="M7.5 6 3.5 10l4 4" />
      <path d="M3.5 10h11a5 5 0 0 1 0 10h-2.5" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="9" width="18" height="11.5" rx="1.5" />
      <path d="M3 13.5h18M12 9v11.5" />
      <path d="M12 9C12 6.5 10.6 4 8.6 4a2.5 2.5 0 0 0 0 5zM12 9c0-2.5 1.4-5 3.4-5a2.5 2.5 0 0 1 0 5z" />
    </>
  ),
  sparkle: (
    <path d="M12 3.5 13.8 8.2 18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.8z" />
  ),

  // Expense
  home: (
    <>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
      <path d="M9.5 21v-6h5v6" />
    </>
  ),
  basket: (
    <>
      <path d="M3 9h18l-1.6 9.3a2 2 0 0 1-2 1.7H6.6a2 2 0 0 1-2-1.7z" />
      <path d="M8 9l2.5-5M16 9l-2.5-5" />
    </>
  ),
  cutlery: (
    <>
      <path d="M6.5 3v5a2 2 0 0 0 4 0V3M8.5 10v11" />
      <path d="M17.5 21V3c2 .8 3 3.6 3 6.2s-1 4.3-3 4.3" />
    </>
  ),
  bolt: <path d="M13.5 2.5 5 14h6l-1 7.5L19 10h-6z" />,
  car: (
    <>
      <path d="M4.5 13 6 7.6A2 2 0 0 1 8 6h8a2 2 0 0 1 2 1.6L19.5 13" />
      <path d="M4 13h16v4H4z" />
      <circle cx="7.5" cy="17.5" r="1.5" />
      <circle cx="16.5" cy="17.5" r="1.5" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </>
  ),
  heart: (
    <path d="M12 20.5S3.5 15.2 3.5 9.5A4.6 4.6 0 0 1 12 6.6a4.6 4.6 0 0 1 8.5 2.9c0 5.7-8.5 11-8.5 11z" />
  ),
  bag: (
    <>
      <path d="M5 8h14l1 12.5H4z" />
      <path d="M8.5 8V6a3.5 3.5 0 0 1 7 0v2" />
    </>
  ),
  play: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M10 8.2 16 12l-6 3.8z" />
    </>
  ),
  cap: (
    <>
      <path d="M2.5 8.5 12 4.2l9.5 4.3L12 12.8z" />
      <path d="M6.5 10.7V16c0 1.5 2.5 2.7 5.5 2.7s5.5-1.2 5.5-2.7v-5.3" />
    </>
  ),
  plane: (
    <>
      <path d="M21.5 3 2.5 10.5l7.5 3 3 7.5z" />
      <path d="M21.5 3 10 13.5" />
    </>
  ),
  dots: (
    <g fill="currentColor" stroke="none">
      <circle cx="6" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="18" cy="12" r="1.3" />
    </g>
  ),

  // Accounts
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18" />
      <circle cx="17" cy="14.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  vault: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <path d="M6.5 20v1.5M17.5 20v1.5" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  coins: (
    <>
      <ellipse cx="9" cy="7" rx="6" ry="3" />
      <path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7" />
      <path d="M15 11.2c3.4.3 6 1.5 6 2.8v4c0 1.7-2.7 3-6 3s-6-1.3-6-3v-4" />
    </>
  ),
  bank: (
    <>
      <path d="M3 9.5 12 4l9 5.5" />
      <path d="M5 9.5v9M10 9.5v9M14 9.5v9M19 9.5v9" />
      <path d="M2.5 20.5h19" />
    </>
  ),

  // Ledger directions
  swap: (
    <>
      <path d="M4 8.5h13M13.5 5 17 8.5 13.5 12" />
      <path d="M20 15.5H7M10.5 12 7 15.5 10.5 19" />
    </>
  ),
  trendUp: (
    <>
      <path d="M3 17 9.5 10.5l4 4L21 7" />
      <path d="M15 7h6v6" />
    </>
  ),
  trendDown: (
    <>
      <path d="M3 7l6.5 6.5 4-4L21 17" />
      <path d="M15 17h6v-6" />
    </>
  ),

  // Affordances
  pencil: (
    <>
      <path d="M4 20h4L18.6 9.4a2.1 2.1 0 0 0-3-3L5 17z" />
      <path d="M14.5 6 18 9.5" />
    </>
  ),
  trash: (
    <>
      <path d="M4 6.5h16M9.5 6.5v-2h5v2" />
      <path d="M6.5 6.5l.9 12.6a2 2 0 0 0 2 1.9h5.2a2 2 0 0 0 2-1.9l.9-12.6" />
      <path d="M10 10.5V17M14 10.5V17" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "h-4 w-4",
}: {
  name: IconName;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {PATHS[name]}
    </svg>
  );
}
