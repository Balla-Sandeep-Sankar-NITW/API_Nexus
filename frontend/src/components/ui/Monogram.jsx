import { initials } from "../../utils/initials";

// Two-letter project mark with a color picked deterministically from the name,
// so each project keeps the same color everywhere without storing anything.
function hue(name = "") {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 6;
}

export default function Monogram({ name, small }) {
  return (
    <span className={`monogram monogram-${hue(name)}${small ? " monogram-sm" : ""}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
