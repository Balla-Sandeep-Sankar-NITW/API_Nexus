import { useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

const EDGE_TYPES = ["depends_on", "calls", "uses_schema", "uses_auth", "custom"];

export default function AddEdgeModal({ projectId, nodes, onClose, onCreated }) {
  const [source, setSource] = useState(nodes[0]?.id || "");
  const [target, setTarget] = useState(nodes[1]?.id || "");
  const [edgeType, setEdgeType] = useState("depends_on");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (source === target) {
      setError("A node cannot depend on itself. Pick two different nodes.");
      return;
    }
    setSaving(true);
    try {
      const edge = await api.post(`/projects/${projectId}/edges`, {
        source_node_id: source,
        target_node_id: target,
        edge_type: edgeType,
        description,
      });
      push("Dependency link added", "success");
      onCreated(edge);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add dependency link"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="add-edge-form" type="submit" disabled={saving || nodes.length < 2}>
            {saving ? "Linking…" : "Add link"}
          </button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      {nodes.length < 2 ? (
        <p style={{ fontSize: 13 }}>You need at least two nodes on the graph before you can link them.</p>
      ) : (
        <form id="add-edge-form" onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="edge-source">Source (depends on target)</label>
            <select id="edge-source" value={source} onChange={(e) => setSource(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="edge-target">Target</label>
            <select id="edge-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              {nodes.map((n) => (
                <option key={n.id} value={n.id}>{n.label}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="edge-type">Relationship type</label>
            <select id="edge-type" value={edgeType} onChange={(e) => setEdgeType(e.target.value)}>
              {EDGE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="edge-desc">Description (optional)</label>
            <input id="edge-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Order service calls Payment service to charge cards" />
          </div>
        </form>
      )}
    </Modal>
  );
}
