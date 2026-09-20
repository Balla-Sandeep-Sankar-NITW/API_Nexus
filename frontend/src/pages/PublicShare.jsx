import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api/client";
import GraphCanvas from "../components/GraphCanvas";

export default function PublicShare() {
  const { shareToken } = useParams();
  const [project, setProject] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    Promise.all([api.get(`/public/${shareToken}/project`), api.get(`/public/${shareToken}/graph`)])
      .then(([p, g]) => {
        setProject(p);
        setGraph(g);
      })
      .catch((err) => setError(err.message));
  }, [shareToken]);

  if (error) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">API Nexus</div>
          <div className="auth-error" style={{ marginTop: 12 }}>{error}</div>
        </div>
      </div>
    );
  }

  if (!project || !graph) {
    return <div className="loading-row"><span className="spinner" />Loading shared graph…</div>;
  }

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) || null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--surface-1)" }}>
      <div className="topbar">
        <div className="breadcrumb">
          <span style={{ fontWeight: 600, color: "var(--ink-900)" }}>API Nexus</span>
          <span>/</span>
          <span className="current">{project.name}</span>
        </div>
        <span className="role-chip">Read-only shared view</span>
      </div>
      <div className="content">
        <h1>{project.name}</h1>
        <p className="page-subtitle">{project.description || "No description"} — {graph.nodes.length} nodes, {graph.edges.length} edges</p>

        <div className="graph-workspace">
          <GraphCanvas
            nodes={graph.nodes}
            edges={graph.edges}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onPositionCommit={() => {}}
            highlightedIds={new Set()}
          />
          <div className="graph-detail-panel">
            {selectedNode ? (
              <div className="detail-section">
                <div className="detail-label">
                  {selectedNode.method ? `${selectedNode.method} ${selectedNode.path}` : selectedNode.node_type.toUpperCase()}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{selectedNode.label}</div>
                {selectedNode.description && (
                  <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>{selectedNode.description}</p>
                )}
              </div>
            ) : (
              <div className="detail-empty">Select a node to view its details.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
