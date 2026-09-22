// One outline icon set (24px grid, 2px stroke, round caps). Icons are used only
// where they carry meaning that text alone would not: zoom/fit controls,
// close, search, status in toasts. Text buttons stay text.
const PATHS = {
  plus: "M5 12h14M12 5v14",
  minus: "M5 12h14",
  x: "M18 6 6 18M6 6l12 12",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3",
  "chevron-down": "m6 9 6 6 6-6",
  fit: "M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3",
  arrange: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
  "check-circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM9 12l2 2 4-4",
  "alert-circle": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM12 8v4M12 16h.01",
};

export default function Icon({ name, size = 16, className = "" }) {
  return (
    <svg
      className={`icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
