import { useState } from "react";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { EDGE_TYPES } from "../utils/graphTypes";

// PATCH /projects/{id}/edges/{edgeId}: relationship type and description.
// The two ends of a link can't change; remove it and add a new one for that.
export default function EditEdgeModal({ projectId, edge, sourceLabel, targetLabel, onClose, onSaved }) {
  const [edgeType, setEdgeType] = useState(edge.edge_type);
  const [description, setDescription] = useState(edge.description || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const dirty = edgeType !== edge.edge_type || description !== (edge.description || "");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${projectId}/edges/${edge.id}`, { edge_type: edgeType, description });
      push("Link updated", "success");
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
      title="Edit link"
      onClose={onClose}
      width="460px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn btn-primary${saving ? " is-loading" : ""}`} form="edit-edge-form" type="submit" disabled={saving || !dirty} aria-busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <p className="text-sm" style={{ marginTop: 0, color: "var(--ink-700)" }}>
        <strong>{sourceLabel}</strong> depends on <strong>{targetLabel}</strong>
      </p>
      <form id="edit-edge-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="ee-type">Relationship type</label>
          <select id="ee-type" value={edgeType} onChange={(e) => setEdgeType(e.target.value)}>
            {EDGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="ee-desc">Description</label>
          <input id="ee-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Why this dependency exists" />
        </div>
      </form>
    </Modal>
  );
}
