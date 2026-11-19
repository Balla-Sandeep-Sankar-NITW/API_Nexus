// Small brand mark: three linked nodes, standing in for the dependency
// graph the product visualizes. Used instead of a bare text logo.
export default function Logomark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <rect width="28" height="28" rx="7" fill="var(--accent)" />
      <g stroke="rgba(255,255,255,0.55)" strokeWidth="1.3">
        <line x1="9" y1="9" x2="19" y2="9" />
        <line x1="9" y1="9" x2="14" y2="19" />
        <line x1="19" y1="9" x2="14" y2="19" />
      </g>
      <circle cx="9" cy="9" r="2.6" fill="#fff" />
      <circle cx="19" cy="9" r="2.6" fill="#fff" />
      <circle cx="14" cy="19" r="2.6" fill="#fff" fillOpacity="0.85" />
    </svg>
  );
}
