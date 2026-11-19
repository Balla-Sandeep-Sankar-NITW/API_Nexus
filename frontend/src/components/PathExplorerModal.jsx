import { useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function PathExplorerModal({ projectId, nodes, onClose, onFocusChain }) {
  const [source, setSource] = useState(nodes[0]?.id || "");
  const [target, setTarget] = useState(nodes[1]?.id || "");
  const [direction, setDirection] = useState("dependencies");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  async function handleFind() {
    if (source === target) {
      push("Choose two different nodes", "error");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post(`/projects/${projectId}/path`, {
        source_node_id: source,
        target_node_id: target,
        direction,
      });
      setResult(res);
      if (res.reachable) onFocusChain(res.path);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      title="Dependency path explorer"
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button type="button" className={`btn btn-primary${loading ? " is-loading" : ""}`} onClick={handleFind} disabled={loading || nodes.length < 2} aria-busy={loading}>
            {loading ? "Searching…" : "Find path"}
          </button>
        </>
      }
    >
      {nodes.length < 2 ? (
        <p className="text-sm">You need at least two nodes on the graph to explore a path.</p>
      ) : (
        <>
          <div className="field">
            <label htmlFor="path-source">Source</label>
            <select id="path-source" value={source} onChange={(e) => setSource(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="path-target">Target</label>
            <select id="path-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="path-direction">Direction</label>
            <select id="path-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
              <option value="dependencies">Source depends on → target</option>
              <option value="dependents">Target depends on → source</option>
            </select>
          </div>

          {result && (
            <div style={{ marginTop: "var(--sp-4)" }} aria-live="polite">
              {result.reachable ? (
                <>
                  <div className="field-hint" style={{ margin: "0 0 var(--sp-2)" }}>
                    Shortest path — {result.length} hop{result.length === 1 ? "" : "s"}. Highlighted on the graph.
                  </div>
                  <div className="path-chain path-static">{result.path_labels.join(" → ")}</div>
                </>
              ) : (
                <div className="field-hint">No dependency path found between these two nodes in this direction.</div>
              )}
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
