import { useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

const NODE_TYPES = ["service", "database", "external", "api", "schema", "auth", "custom"];

export default function AddNodeModal({ projectId, onClose, onCreated }) {
  const [label, setLabel] = useState("");
  const [nodeType, setNodeType] = useState("service");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const node = await api.post(`/projects/${projectId}/nodes`, {
        label,
        node_type: nodeType,
        description,
        pos_x: Math.round(200 + Math.random() * 400),
        pos_y: Math.round(150 + Math.random() * 300),
      });
      push(`Node "${node.label}" added`, "success");
      onCreated(node);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Add node"
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" form="add-node-form" type="submit" disabled={saving}>
            {saving ? "Adding…" : "Add node"}
          </button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      <form id="add-node-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="node-label">Name</label>
          <input id="node-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="InventoryService" required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="node-type">Type</label>
          <select id="node-type" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
            {NODE_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="node-desc">Description</label>
          <textarea id="node-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this component does" />
        </div>
      </form>
    </Modal>
  );
}
