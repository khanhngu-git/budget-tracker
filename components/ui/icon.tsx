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

  fuel: (
    <>
      <path d="M4 21V5.5A2.5 2.5 0 0 1 6.5 3h4A2.5 2.5 0 0 1 13 5.5V21" />
      <path d="M2.5 21h12M6.5 8h4" />
      <path d="M13 10h3.5A1.5 1.5 0 0 1 18 11.5v5a1.75 1.75 0 0 0 3.5 0V8.5L19 6" />
    </>
  ),
  bus: (
    <>
      <rect x="4" y="3.5" width="16" height="12.5" rx="2" />
      <path d="M4 10.5h16M5.5 16v1.8M18.5 16v1.8" />
      <circle cx="7.5" cy="13.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="16.5" cy="13.2" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  receipt: (
    <>
      <path d="M5 21.2V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17.2l-2.3-1.5-2.3 1.5-2.4-1.5-2.4 1.5-2.3-1.5z" />
      <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 5.5h3" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  wifi: (
    <>
      <path d="M2.5 9.2a14 14 0 0 1 19 0" />
      <path d="M6 12.7a9 9 0 0 1 12 0" />
      <path d="M9.4 16.2a4.5 4.5 0 0 1 5.2 0" />
      <circle cx="12" cy="19.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  droplet: (
    <path d="M12 3s6 6.3 6 10.2A6 6 0 0 1 6 13.2C6 9.3 12 3 12 3z" />
  ),
  flame: (
    <>
      <path d="M12 21.5a6.5 6.5 0 0 0 6.5-6.5c0-4.8-6.5-12.5-6.5-12.5S5.5 10.2 5.5 15A6.5 6.5 0 0 0 12 21.5z" />
      <path d="M12 21.5a2.7 2.7 0 0 0 2.7-2.7c0-2-2.7-5.1-2.7-5.1s-2.7 3.1-2.7 5.1A2.7 2.7 0 0 0 12 21.5z" />
    </>
  ),
  shield: (
    <path d="M12 2.8 19.5 5.7v5.4c0 4.4-3.1 8.5-7.5 9.8-4.4-1.3-7.5-5.4-7.5-9.8V5.7z" />
  ),
  repeat: (
    <>
      <path d="M3.5 10V8.5A3.5 3.5 0 0 1 7 5h11" />
      <path d="M14.5 1.5 18 5l-3.5 3.5" />
      <path d="M20.5 14v1.5A3.5 3.5 0 0 1 17 19H6" />
      <path d="M9.5 22.5 6 19l3.5-3.5" />
    </>
  ),
  pill: (
    <>
      <rect
        x="2.6"
        y="8.8"
        width="18.8"
        height="6.4"
        rx="3.2"
        transform="rotate(-45 12 12)"
      />
      <path d="M9.2 9.2 14.8 14.8" />
    </>
  ),
  dumbbell: <path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" />,
  scissors: (
    <>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.2 7.9 20 17.5M8.2 16.1 20 6.5" />
    </>
  ),
  paw: (
    <>
      <ellipse cx="6.8" cy="9.6" rx="1.8" ry="2.3" />
      <ellipse cx="12" cy="7.6" rx="1.9" ry="2.5" />
      <ellipse cx="17.2" cy="9.6" rx="1.8" ry="2.3" />
      <path d="M12 12.6c-2.7 0-5 2.2-5 4.8 0 2 1.5 3.4 3.4 3.4.7 0 1.1-.3 1.6-.3s.9.3 1.6.3c1.9 0 3.4-1.4 3.4-3.4 0-2.6-2.3-4.8-5-4.8z" />
    </>
  ),
  baby: (
    <>
      <circle cx="12" cy="7.5" r="4.8" />
      <path d="M10.3 10c1 .7 2.4.7 3.4 0" />
      <circle cx="10.2" cy="6.6" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="13.8" cy="6.6" r="0.8" fill="currentColor" stroke="none" />
      <path d="M5.5 21v-1.5a4 4 0 0 1 4-4h5a4 4 0 0 1 4 4V21" />
    </>
  ),
  wrench: (
    <path d="M15.6 3.4a5 5 0 0 0-6 6.5l-6 6a2.3 2.3 0 0 0 3.2 3.2l6-6a5 5 0 0 0 6.5-6l-3 3-2.7-2.7z" />
  ),
  coffee: (
    <>
      <path d="M3.5 8h13.5v6.6a4.4 4.4 0 0 1-4.4 4.4H7.9a4.4 4.4 0 0 1-4.4-4.4z" />
      <path d="M17 10.2h1.6a2.4 2.4 0 0 1 0 4.8H17" />
      <path d="M3.5 21.5h14" />
    </>
  ),
  scales: (
    <>
      <path d="M12 4.5v15.5M7.5 20h9" />
      <path d="M12 6.5 4.5 8.5M12 6.5 19.5 8.5" />
      <path d="M4.5 8.5 1.8 14.5a2.9 2.9 0 0 0 5.4 0z" />
      <path d="M19.5 8.5 16.8 14.5a2.9 2.9 0 0 0 5.4 0z" />
    </>
  ),
  medal: (
    <>
      <circle cx="12" cy="15" r="5.5" />
      <path d="M7.6 11 5 3h14l-2.6 8" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="14.5" r="3.6" />
      <path d="M10.1 12 20 2.5M17.2 5.3l2.4 2.4M14.6 7.9l2.1 2.1" />
    </>
  ),
  tag: (
    <>
      <path d="M3 11.6V4.5a1.5 1.5 0 0 1 1.5-1.5h7.1l9.4 9.4-8.6 8.6z" />
      <circle cx="7.6" cy="7.6" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  percent: (
    <>
      <path d="M5 19 19 5" />
      <circle cx="7.6" cy="7.6" r="2.6" />
      <circle cx="16.4" cy="16.4" r="2.6" />
    </>
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
  debt: (
    <>
      <rect x="2.5" y="7" width="14" height="12" rx="2" />
      <path d="M2.5 11h14" />
      <path d="M17 3.5h4.5V8M21.5 3.5 15.5 9.5" />
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
  chevronLeft: <path d="M15 5.5 8.5 12l6.5 6.5" />,
  chevronRight: <path d="M9 5.5 15.5 12 9 18.5" />,
  star: (
    <path d="M12 3.75l2.65 5.37 5.93.86-4.29 4.18 1.01 5.9L12 17.28l-5.3 2.78 1.01-5.9-4.29-4.18 5.93-.86z" />
  ),
  image: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2" />
      <circle cx="8.5" cy="10" r="1.75" />
      <path d="M3.5 17.5 9 12.5l3.5 3 3-2.5 5 4.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4.5" />
      <path d="M7.5 9 12 4.5 16.5 9" />
      <path d="M4 15.5v2.5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.5" />
    </>
  ),
  check: <path d="M4.5 12.5 9.5 17.5 19.5 6.5" />,
  alert: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.5v5.5" />
      <circle cx="12" cy="16.6" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.3 15.3 21 21" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  logOut: (
    <>
      <path d="M13.5 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h7.5" />
      <path d="M16.5 8.5 20 12l-3.5 3.5" />
      <path d="M20 12H9.5" />
    </>
  ),
  cog: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M21.5 12h-2.4M4.9 12H2.5M18.7 5.3l-1.7 1.7M7 17l-1.7 1.7M18.7 18.7 17 17M7 7 5.3 5.3" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
    </>
  ),
  moon: (
    <path d="M20.5 14.8A8.6 8.6 0 0 1 9.2 3.5 8.6 8.6 0 1 0 20.5 14.8z" />
  ),
  monitor: (
    <>
      <rect x="2.5" y="4" width="19" height="12.5" rx="2" />
      <path d="M8.5 20.5h7M12 16.5v4" />
    </>
  ),
  palette: (
    <>
      <path d="M12 3.2a8.8 8.8 0 0 0 0 17.6c1.4 0 2.1-.8 2.1-1.8 0-.5-.2-.9-.5-1.3-.3-.3-.5-.7-.5-1.1 0-.9.7-1.6 1.6-1.6h1.5a4.8 4.8 0 0 0 4.8-4.8c0-3.9-4-7-9-7z" />
      <circle cx="7.6" cy="11.4" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.4" cy="7.6" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="8.2" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3z" />
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
