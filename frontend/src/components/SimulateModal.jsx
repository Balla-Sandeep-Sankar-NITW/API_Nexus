import { useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function SimulateModal({ projectId, node, onClose, onFocusChain }) {
  const [mode, setMode] = useState("removal");
  const [direction, setDirection] = useState("dependents");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  async function runSimulation() {
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/simulate`, {
        node_id: node.id,
        mode,
        direction,
      });
      setResult(res);
      onFocusChain(new Set([node.id, ...res.affected.map((a) => a.node_id)]));
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title={`Simulate: ${node.label}`} onClose={onClose} width="480px">
      <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
        Non-destructive — nothing on the graph is changed. This shows what {mode === "removal" ? "would break if this were permanently removed" : "would happen during a temporary outage"}.
      </p>
      <div className="field">
        <label>Scenario</label>
        <select value={mode} onChange={(e) => setMode(e.target.value)}>
          <option value="removal">Permanent removal</option>
          <option value="failure">Temporary failure / outage</option>
        </select>
      </div>
      <div className="field">
        <label>Direction</label>
        <select value={direction} onChange={(e) => setDirection(e.target.value)}>
          <option value="dependents">What depends on this</option>
          <option value="dependencies">What this depends on</option>
        </select>
      </div>
      <button className="btn btn-primary btn-sm" onClick={runSimulation} disabled={loading}>
        {loading ? "Simulating…" : "Run simulation"}
      </button>

      {result && (
        <div style={{ marginTop: 16 }}>
          <div className="detail-row"><span className="k">Total affected</span><span className="v">{result.total_affected}</span></div>
          <div className="detail-row"><span className="k">Fully orphaned (no remaining dependencies)</span><span className="v">{result.total_orphaned}</span></div>

          {result.orphaned.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="detail-label">
                {mode === "removal" ? "Would be completely disconnected" : "Would completely lose service"}
              </div>
              {result.orphaned.map((a) => (
                <div key={a.node_id} className="impact-path">{a.path.join(" → ")}</div>
              ))}
            </div>
          )}

          {result.affected.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="detail-label">All affected (touched, not necessarily orphaned)</div>
              {result.affected.map((a) => (
                <div key={a.node_id} style={{ fontSize: 12.5, padding: "3px 0" }}>{a.label} — depth {a.depth}</div>
              ))}
            </div>
          )}

          {result.total_affected === 0 && (
            <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>Nothing depends on this component in the selected direction.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
