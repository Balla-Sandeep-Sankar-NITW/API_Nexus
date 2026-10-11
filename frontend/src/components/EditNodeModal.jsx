import { useState } from "react";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { NODE_TYPES } from "../utils/graphTypes";

// PATCH /projects/{id}/nodes/{nodeId}: label, description and type.
export default function EditNodeModal({ projectId, node, onClose, onSaved }) {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description || "");
  const [nodeType, setNodeType] = useState(node.node_type);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const dirty = label.trim() !== node.label || description !== (node.description || "") || nodeType !== node.node_type;

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${projectId}/nodes/${node.id}`, {
        label: label.trim(),
        description,
        node_type: nodeType,
      });
      push("Node updated", "success");
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit node"
      onClose={onClose}
      width="460px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn btn-primary${saving ? " is-loading" : ""}`} form="edit-node-form" type="submit" disabled={saving || !dirty || !label.trim()} aria-busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <form id="edit-node-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="en-label">Name</label>
          <input id="en-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="en-type">Type</label>
          <select id="en-type" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
            {NODE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="en-desc">Description</label>
          <textarea id="en-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </form>
    </Modal>
  );
}
