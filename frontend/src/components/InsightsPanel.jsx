import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import EmptyState from "./ui/EmptyState";

const INITIAL_ROWS = 20;

const SEVERITY_BADGE = { high: "badge-red", medium: "badge-amber", low: "badge-gray" };

export default function InsightsPanel({ graph, projectId, onOpenNode }) {
  const [showAll, setShowAll] = useState(false);
  const [findings, setFindings] = useState(null); // { findings, high_count, medium_count, low_count }

  // Findings are computed server-side from the live graph, so reload whenever the
  // graph changes (an import, a new link, a deleted node).
  useEffect(() => {
    if (!projectId) return;
    api.get(`/projects/${projectId}/findings`).then(setFindings).catch(() => setFindings({ findings: [], high_count: 0, medium_count: 0, low_count: 0 }));
  }, [projectId, graph]);

  const stats = useMemo(() => {
    if (!graph) return [];
    const counts = {};
    graph.nodes.forEach((n) => (counts[n.id] = { in: 0, out: 0 }));
    graph.edges.forEach((e) => {
      if (counts[e.source_node_id]) counts[e.source_node_id].out += 1;
      if (counts[e.target_node_id]) counts[e.target_node_id].in += 1;
    });
    const rows = graph.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.node_type,
      dependents: counts[n.id]?.in || 0, // things that depend on it
      dependencies: counts[n.id]?.out || 0, // things it depends on
      total: (counts[n.id]?.in || 0) + (counts[n.id]?.out || 0),
    }));
    rows.sort((a, b) => b.total - a.total);
    return rows;
  }, [graph]);

  const max = stats.length > 0 ? Math.max(...stats.map((s) => s.total), 1) : 1;
  const critical = stats.filter((s) => s.dependents >= 3);

  if (!graph || graph.nodes.length === 0) {
    return (
      <EmptyState title="Nothing to analyze yet">
        Import an OpenAPI spec or add nodes to see connection density and critical components.
      </EmptyState>
    );
  }

  const visible = showAll ? stats : stats.slice(0, INITIAL_ROWS);

  return (
    <>
      <section className="section" aria-labelledby="findings-heading">
        <div className="section-head">
          <h2 id="findings-heading">Findings</h2>
          <p>Structural risks visible from how components depend on each other. Heuristics, not a security audit.</p>
        </div>
        {findings === null && <p className="text-sm text-muted">Checking the graph…</p>}
        {findings && findings.findings.length === 0 && (
          <p className="text-sm" style={{ margin: 0 }}>No findings. Nothing in this graph is unusually concentrated or disconnected.</p>
        )}
        {findings && findings.findings.length > 0 && (
          <>
            <div className="finding-counts">
              <span className="badge badge-red"><span className="badge-dot" aria-hidden="true" />{findings.high_count} high</span>
              <span className="badge badge-amber"><span className="badge-dot" aria-hidden="true" />{findings.medium_count} medium</span>
              <span className="badge badge-gray"><span className="badge-dot" aria-hidden="true" />{findings.low_count} low</span>
            </div>
            <ul className="finding-list">
              {findings.findings.map((f) => (
                <li key={f.id} className="finding">
                  <div className="finding-head">
                    <span className={`badge ${SEVERITY_BADGE[f.severity] || "badge-gray"}`}>{f.severity}</span>
                    <strong>{f.title}</strong>
                  </div>
                  <p>{f.description}</p>
                  <p className="finding-fix"><span className="text-muted">What to do:</span> {f.remediation}</p>
                  {f.node_id && onOpenNode && (
                    <button type="button" className="btn btn-sm" onClick={() => onOpenNode(f.node_id)}>Show on graph</button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {critical.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>High dependency concentration</h2>
            <p>These components have 3 or more services depending on them directly. A failure here has a wide blast radius.</p>
          </div>
          <div className="table-wrap stack">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Component</th>
                  <th scope="col">Type</th>
                  <th scope="col" className="num">Direct dependents</th>
                </tr>
              </thead>
              <tbody>
                {critical.map((c) => (
                  <tr key={c.id}>
                    <td className="primary">{c.label}</td>
                    <td className="text-muted" data-label="Type">{c.type}</td>
                    <td className="num" data-label="Direct dependents">{c.dependents}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>Connections per node</h2>
          <p>Incoming plus outgoing links, highest first.</p>
        </div>
        <div className="table-wrap stack">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Node</th>
                <th scope="col" className="hide-narrow">Type</th>
                <th scope="col" className="num">Dependents</th>
                <th scope="col" className="num">Dependencies</th>
                <th scope="col" className="num">Total</th>
                <th scope="col" className="hide-narrow hide-stack"><span className="sr-only">Relative share</span></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((s) => (
                <tr key={s.id}>
                  <td className="primary">{s.label}</td>
                  <td className="text-muted hide-narrow" data-label="Type">{s.type}</td>
                  <td className="num" data-label="Dependents">{s.dependents}</td>
                  <td className="num" data-label="Dependencies">{s.dependencies}</td>
                  <td className="num" data-label="Total">{s.total}</td>
                  <td className="hide-narrow hide-stack" aria-hidden="true">
                    <span className="meter"><span style={{ width: `${(s.total / max) * 100}%` }} /></span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {stats.length > INITIAL_ROWS && (
          <button type="button" className="btn btn-sm" style={{ marginTop: "var(--sp-3)" }} onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show top 20" : `Show all ${stats.length} nodes`}
          </button>
        )}
      </section>
    </>
  );
}
