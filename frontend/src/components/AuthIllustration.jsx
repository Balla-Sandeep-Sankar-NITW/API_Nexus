// A small, static preview of the real dependency graph: two endpoints
// sharing a schema, one selected auth node with its incoming edge
// highlighted (exactly what selecting a node does in the app), and one
// frozen service. Drawn with the same node/edge language as GraphCanvas,
// just simplified and fixed in place.
const NODES = [
  { id: "a", x: 10, y: 20, kicker: "GET", title: "/api/nodes", mono: true, color: "var(--type-api)" },
  { id: "b", x: 10, y: 100, kicker: "POST", title: "/api/edges", mono: true, color: "var(--type-api)" },
  { id: "c", x: 230, y: 10, kicker: "schema", title: "NodeOut", color: "var(--type-schema)" },
  { id: "e", x: 230, y: 98, kicker: "auth", title: "HTTPBearer", color: "var(--type-auth)", selected: true },
  { id: "d", x: 230, y: 186, kicker: "service", title: "PaymentGateway", color: "var(--type-service)", frozen: true },
];
const EDGES = [
  { from: "a", to: "c" },
  { from: "b", to: "c" },
  { from: "a", to: "e", active: true },
  { from: "b", to: "e" },
  { from: "d", to: "e" },
];
const W = 140;
const H = 34;
const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));

export default function AuthIllustration() {
  return (
    <svg
      className="auth-illustration-svg"
      viewBox="0 0 400 244"
      aria-hidden="true"
      focusable="false"
    >
      {EDGES.map((e) => {
        const from = byId[e.from];
        const to = byId[e.to];
        const x1 = from.x + W;
        const y1 = from.y + H / 2;
        const x2 = to.x;
        const y2 = to.y + H / 2;
        return <line key={e.from + e.to} className={`ai-edge${e.active ? " is-active" : ""}`} x1={x1} y1={y1} x2={x2} y2={y2} />;
      })}
      {NODES.map((n) => (
        <g
          key={n.id}
          className={`ai-node${n.selected ? " is-selected" : ""}${n.frozen ? " is-frozen" : ""}`}
          transform={`translate(${n.x} ${n.y})`}
        >
          <rect className="ai-node-box" width={W} height={H} rx={4} />
          <rect width={4} height={H} rx={1.5} fill={n.color} />
          <text className="ai-kicker" x={12} y={13} fill={n.color}>{n.kicker}</text>
          <text className={`ai-title${n.mono ? " is-mono" : ""}`} x={12} y={26}>{n.title}</text>
          {n.frozen && <text className="ai-state" x={W - 8} y={13}>Frozen</text>}
        </g>
      ))}
    </svg>
  );
}
