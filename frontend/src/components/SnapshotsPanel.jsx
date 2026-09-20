import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

export default function SnapshotsPanel({ projectId, myRole, onRestored }) {
  const [snapshots, setSnapshots] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [label, setLabel] = useState("");
  const [diffs, setDiffs] = useState({});
  const [restoreTarget, setRestoreTarget] = useState(null);
  const { push } = useToast();
  const canCreate = myRole === "leader" || myRole === "member";
  const canRestore = myRole === "leader";

  function load() {
    api.get(`/projects/${projectId}/snapshots`).then(setSnapshots).catch((err) => push(err.message, "error"));
  }

  useEffect(load, [projectId]);

  async function handleCreate(e) {
    e.preventDefault();
    try {
      await api.post(`/projects/${projectId}/snapshots`, { label });
      push("Snapshot saved", "success");
      setShowCreate(false);
      setLabel("");
      load();
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function loadDiff(snapshotId) {
    try {
      const diff = await api.get(`/projects/${projectId}/snapshots/${snapshotId}/diff`);
      setDiffs((d) => ({ ...d, [snapshotId]: diff }));
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleRestore() {
    try {
      await api.post(`/projects/${projectId}/snapshots/${restoreTarget.id}/restore`, {});
      push(`Restored "${restoreTarget.label}"`, "success");
      setRestoreTarget(null);
      onRestored();
    } catch (err) {
      push(err.message, "error");
    }
  }

  if (snapshots === null) {
    return <div className="loading-row"><span className="spinner" />Loading snapshots…</div>;
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-spacer" />
        {canCreate && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>Save snapshot</button>
        )}
      </div>

      {snapshots.length === 0 ? (
        <div className="empty-state panel">
          <h3>No snapshots yet</h3>
          <p>Save a snapshot before a risky change so you can compare or roll back later.</p>
        </div>
      ) : (
        <div className="panel">
          {snapshots.map((s, i) => (
            <div key={s.id} className="detail-section" style={{ borderBottom: i === snapshots.length - 1 ? "none" : undefined }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 13.5 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
                    {s.node_count} nodes, {s.edge_count} edges — {new Date(s.created_at).toLocaleString()}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="btn btn-sm" onClick={() => loadDiff(s.id)}>Compare to current</button>
                  {canRestore && (
                    <button className="btn btn-sm btn-danger" onClick={() => setRestoreTarget(s)}>Restore</button>
                  )}
                </div>
              </div>
              {diffs[s.id] && (
                <div style={{ marginTop: 10, fontSize: 12.5 }}>
                  {diffs[s.id].nodes_added.length === 0 && diffs[s.id].nodes_removed.length === 0 ? (
                    <span style={{ color: "var(--ink-500)" }}>No node differences since this snapshot.</span>
                  ) : (
                    <>
                      {diffs[s.id].nodes_added.length > 0 && (
                        <div style={{ marginBottom: 4 }}>
                          <span className="badge badge-green" style={{ marginRight: 6 }}><span className="badge-dot" />added</span>
                          {diffs[s.id].nodes_added.join(", ")}
                        </div>
                      )}
                      {diffs[s.id].nodes_removed.length > 0 && (
                        <div>
                          <span className="badge badge-red" style={{ marginRight: 6 }}><span className="badge-dot" />removed</span>
                          {diffs[s.id].nodes_removed.join(", ")}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <Modal
          title="Save snapshot"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" form="snapshot-form" type="submit">Save</button>
            </>
          }
        >
          <form id="snapshot-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="snap-label">Label</label>
              <input id="snap-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Before payments refactor" required autoFocus />
            </div>
          </form>
        </Modal>
      )}

      {restoreTarget && (
        <ConfirmDialog
          title="Restore snapshot"
          message={`Replace the current graph with "${restoreTarget.label}"? All current nodes and links not in this snapshot will be permanently removed. This cannot be undone.`}
          confirmLabel="Restore"
          danger
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </div>
  );
}
