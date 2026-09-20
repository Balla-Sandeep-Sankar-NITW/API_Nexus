import { useMemo } from "react";

export default function InsightsPanel({ graph }) {
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
      <div className="empty-state panel">
        <h3>Nothing to analyze yet</h3>
        <p>Import an OpenAPI spec or add nodes to see connection density and critical components.</p>
      </div>
    );
  }

  return (
    <div>
      {critical.length > 0 && (
        <div className="panel" style={{ marginBottom: 16 }}>
          <div className="panel-header"><h2 style={{ margin: 0 }}>High dependency concentration</h2></div>
          <div className="panel-body">
            <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
              These components have 3 or more services depending on them directly — a failure here has a wide blast radius.
            </p>
            {critical.map((c) => (
              <div key={c.id} className="detail-row">
                <span className="k">{c.label}</span>
                <span className="v">{c.dependents} direct dependents</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header"><h2 style={{ margin: 0 }}>Dependency heatmap</h2></div>
        <div className="panel-body">
          <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
            Total connections (incoming + outgoing) per node.
          </p>
          {stats.map((s) => (
            <div key={s.id} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                <span>{s.label}</span>
                <span style={{ color: "var(--ink-500)" }}>{s.total}</span>
              </div>
              <div style={{ background: "var(--surface-2)", borderRadius: 3, height: 6, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(s.total / max) * 100}%`,
                    background: "var(--accent)",
                    height: "100%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
