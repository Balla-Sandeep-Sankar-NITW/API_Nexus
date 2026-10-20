import { useState } from "react";

const LEVEL_LABEL = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const INITIAL = 10;

// Riskiest nodes first, with the reasons behind each score. The server computes
// the score (see GET /risk); this just presents it.
export default function RiskRanking({ risk, onOpenNode }) {
  const [showAll, setShowAll] = useState(false);

  if (!risk) return <p className="text-sm text-muted">Scoring the graph…</p>;

  const scored = risk.nodes.filter((n) => n.score > 0);
  const visible = showAll ? scored : scored.slice(0, INITIAL);
  const unowned = risk.total_nodes - risk.owned_count;

  return (
    <>
      <div className="finding-counts">
        {["critical", "high", "medium", "low"].map((lvl) => (
          <span key={lvl} className={`badge risk-${lvl}`}>{risk[`${lvl}_count`]} {LEVEL_LABEL[lvl].toLowerCase()}</span>
        ))}
      </div>
      <p className="text-sm" style={{ margin: "0 0 var(--sp-3)", color: "var(--ink-700)" }}>
        {risk.owned_count} of {risk.total_nodes} nodes have an owner
        {unowned > 0 ? `. Open a node and choose Edit node to assign the other ${unowned}.` : "."}
      </p>

      {scored.length === 0 ? (
        <p className="text-sm" style={{ margin: 0 }}>No node carries any risk right now.</p>
      ) : (
        <div className="table-wrap stack">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col" className="hide-narrow">Type</th>
                <th scope="col">Risk</th>
                <th scope="col" className="hide-narrow">Why</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((n) => (
                <tr key={n.node_id}>
                  <td className="primary">{n.label}</td>
                  <td className="text-muted hide-narrow" data-label="Type">{n.node_type}</td>
                  <td data-label="Risk"><span className={`badge risk-${n.level}`}>{n.score} · {LEVEL_LABEL[n.level]}</span></td>
                  <td className="text-muted hide-narrow" data-label="Why">{n.factors.map((f) => f.label).join(", ")}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenNode(n.node_id)}>Show</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {scored.length > INITIAL && (
        <button type="button" className="btn btn-sm" style={{ marginTop: "var(--sp-3)" }} onClick={() => setShowAll((v) => !v)}>
          {showAll ? `Show top ${INITIAL}` : `Show all ${scored.length} scored nodes`}
        </button>
      )}
    </>
  );
}
