import { useState } from "react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

const EDGE_TYPES = ["depends_on", "calls", "uses_schema", "uses_auth", "custom"];

export default function EdgeManagerModal({ projectId, nodes, edges, onClose, onUpdated, onDeleted }) {
  const [editing, setEditing] = useState({}); // edgeId -> {edge_type, description}
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { push } = useToast();
  const labelFor = (id) => nodes.find((n) => n.id === id)?.label || "Unknown";

  function startEdit(edge) {
    setEditing((e) => ({ ...e, [edge.id]: { edge_type: edge.edge_type, description: edge.description } }));
  }

  async function saveEdit(edge) {
    const draft = editing[edge.id];
    try {
      const updated = await api.patch(`/projects/${projectId}/edges/${edge.id}`, draft);
      onUpdated(updated);
      setEditing((e) => {
        const next = { ...e };
        delete next[edge.id];
        return next;
      });
      push("Link updated", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/projects/${projectId}/edges/${deleteTarget.id}`);
      onDeleted(deleteTarget.id);
      push("Link removed", "success");
      setDeleteTarget(null);
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <Modal title="Manage dependency links" onClose={onClose} width="600px">
      {edges.length === 0 ? (
        <p style={{ fontSize: 13 }}>No links yet.</p>
      ) : (
        <div style={{ maxHeight: 420, overflowY: "auto" }}>
          {edges.map((edge) => {
            const draft = editing[edge.id];
            return (
              <div key={edge.id} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)" }}>
                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                  <strong>{labelFor(edge.source_node_id)}</strong> → <strong>{labelFor(edge.target_node_id)}</strong>
                  {edge.source_origin === "openapi" && (
                    <span className="role-chip" style={{ marginLeft: 6 }}>from OpenAPI</span>
                  )}
                </div>
                {draft ? (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <select
                      value={draft.edge_type}
                      onChange={(e) => setEditing((s) => ({ ...s, [edge.id]: { ...draft, edge_type: e.target.value } }))}
                      style={{ fontSize: 12, padding: "4px 6px" }}
                    >
                      {EDGE_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <input
                      value={draft.description}
                      onChange={(e) => setEditing((s) => ({ ...s, [edge.id]: { ...draft, description: e.target.value } }))}
                      placeholder="Description"
                      style={{ flex: 1, minWidth: 140, fontSize: 12, padding: "4px 8px" }}
                    />
                    <button className="btn btn-sm btn-primary" onClick={() => saveEdit(edge)}>Save</button>
                  </div>
                ) : (
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--ink-500)" }}>
                      {edge.edge_type}{edge.description ? ` — ${edge.description}` : ""}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button className="btn btn-sm" onClick={() => startEdit(edge)}>Edit</button>
                      <button className="btn btn-sm btn-ghost" onClick={() => setDeleteTarget(edge)}>Delete</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete link"
          message={`Remove the link from "${labelFor(deleteTarget.source_node_id)}" to "${labelFor(deleteTarget.target_node_id)}"?`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </Modal>
  );
}
