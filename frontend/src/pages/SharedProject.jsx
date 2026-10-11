import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { computeLayeredLayout } from "../utils/layout";
import GraphCanvas from "../components/GraphCanvas";
import Logomark from "../components/ui/Logomark";
import Monogram from "../components/ui/Monogram";
import EmptyState from "../components/ui/EmptyState";
import LoadingRow from "../components/ui/LoadingRow";

const NO_HIGHLIGHT = new Set();

// Public, read-only view reached through a leader's share link (/shared/:token).
// Talks to /api/public/{token}/..., which needs no login.
export default function SharedProject() {
  const { token } = useParams();
  const [project, setProject] = useState(null);
  const [graph, setGraph] = useState(null);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    Promise.all([
      api.get(`/public/${token}/project`, { auth: false }),
      api.get(`/public/${token}/graph`, { auth: false }),
    ])
      .then(([p, g]) => {
        // Nodes that were never arranged sit at 0,0; lay them out locally
        // (nothing is saved from a read-only view).
        if (g.nodes.length > 0 && g.nodes.every((n) => n.pos_x === 0 && n.pos_y === 0)) {
          const computed = computeLayeredLayout(g.nodes, g.edges);
          g = { ...g, nodes: g.nodes.map((n) => (computed[n.id] ? { ...n, pos_x: computed[n.id].x, pos_y: computed[n.id].y } : n)) };
        }
        setProject(p);
        setGraph(g);
      })
      .catch((err) => setError(err.message || "This share link is invalid or has been revoked."));
  }, [token]);

  const selected = graph?.nodes.find((n) => n.id === selectedId) || null;
  const links = useMemo(() => {
    if (!graph || !selected) return { dependsOn: [], usedBy: [] };
    const label = Object.fromEntries(graph.nodes.map((n) => [n.id, n.label]));
    return {
      dependsOn: graph.edges.filter((e) => e.source_node_id === selected.id).map((e) => ({ id: e.id, label: label[e.target_node_id], type: e.edge_type })),
      usedBy: graph.edges.filter((e) => e.target_node_id === selected.id).map((e) => ({ id: e.id, label: label[e.source_node_id], type: e.edge_type })),
    };
  }, [graph, selected]);

  return (
    <div className="shared-shell">
      <header className="shared-bar">
        <span className="shared-brand"><Logomark /> API Nexus</span>
        <span className="badge badge-gray"><span className="badge-dot" aria-hidden="true" />Read-only shared view</span>
        <span className="toolbar-spacer" />
        <Link to="/login" className="btn btn-sm">Log in</Link>
      </header>

      {error && (
        <div className="page-inner is-narrow" style={{ paddingTop: "var(--sp-8)" }}>
          <EmptyState title="This link doesn't work" action={<Link to="/login" className="btn btn-primary">Go to API Nexus</Link>}>
            {error} Ask the project leader for a new share link.
          </EmptyState>
        </div>
      )}

      {!error && (!project || !graph) && <LoadingRow>Loading shared project…</LoadingRow>}

      {project && graph && (
        <div className="shared-body">
          <div className="project-header-row" style={{ marginBottom: "var(--sp-4)" }}>
            <Monogram name={project.name} />
            <div className="project-header-text">
              <h1>{project.name}</h1>
              {project.description && <p>{project.description}</p>}
            </div>
          </div>

          {graph.nodes.length === 0 ? (
            <EmptyState title="This graph is empty" />
          ) : (
            <div className="graph-workspace">
              <GraphCanvas
                nodes={graph.nodes}
                allNodes={graph.nodes}
                edges={graph.edges}
                selectedId={selectedId}
                onSelect={setSelectedId}
                highlightedIds={NO_HIGHLIGHT}
                animateChain={null}
              />
              <div className="graph-detail-panel">
                {!selected ? (
                  <div className="detail-empty">
                    <strong>No node selected</strong>
                    Select a node to see what it depends on and what depends on it.
                  </div>
                ) : (
                  <section className="detail-section" aria-label="Node details">
                    <div className="detail-subtitle text-muted">{selected.method ? <span className={`method-tag method-${selected.method}`}>{selected.method}</span> : selected.node_type}</div>
                    <h2 className="detail-title">{selected.label}</h2>
                    {selected.description && <p className="detail-desc">{selected.description}</p>}
                    <h3 className="link-heading">Depends on ({links.dependsOn.length})</h3>
                    <LinkList items={links.dependsOn} empty="Nothing." />
                    <h3 className="link-heading">Used by ({links.usedBy.length})</h3>
                    <LinkList items={links.usedBy} empty="Nothing." />
                  </section>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LinkList({ items, empty }) {
  if (items.length === 0) return <p className="text-sm text-muted" style={{ margin: 0 }}>{empty}</p>;
  return (
    <ul className="link-list">
      {items.map((i) => (
        <li key={i.id}>
          <span className="truncate">{i.label}</span>
          <span className="text-muted">{i.type}</span>
        </li>
      ))}
    </ul>
  );
}
