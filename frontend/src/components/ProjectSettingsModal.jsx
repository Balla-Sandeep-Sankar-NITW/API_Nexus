import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import Alert from "./ui/Alert";

// Leader-only: rename / describe, archive, public share link, and delete.
// Wraps PATCH /projects/{id}, PATCH /projects/{id}/archive, the /share endpoints
// and DELETE /projects/{id} (owner only on the backend).
export default function ProjectSettingsModal({ project, onClose, onChanged }) {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [share, setShare] = useState(null); // { share_token, enabled }
  const [shareBusy, setShareBusy] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isOwner = project.owner_id === user?.id;
  const archived = project.status === "archived";
  const dirty = name.trim() !== project.name || description !== (project.description || "");
  const shareUrl = share?.share_token ? `${window.location.origin}/shared/${share.share_token}` : "";

  useEffect(() => {
    api.get(`/projects/${project.id}/share`).then(setShare).catch(() => setShare({ share_token: null, enabled: false }));
  }, [project.id]);

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty || !name.trim()) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${project.id}`, { name: name.trim(), description });
      push("Project updated", "success");
      onChanged(updated);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleShare() {
    setShareBusy(true);
    try {
      const next = share?.enabled
        ? await api.del(`/projects/${project.id}/share`)
        : await api.post(`/projects/${project.id}/share`);
      // DELETE returns the new state as a body; fall back if the client got a 204.
      setShare(next || { share_token: null, enabled: false });
      push(share?.enabled ? "Share link turned off" : "Share link created", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setShareBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      push("Link copied", "success");
    } catch {
      push("Couldn't copy automatically. Select the link and copy it.", "error");
    }
  }

  async function toggleArchive() {
    setArchiving(true);
    try {
      const updated = await api.patch(`/projects/${project.id}/archive`);
      push(updated.status === "archived" ? "Project archived" : "Project restored", "success");
      onChanged(updated);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setArchiving(false);
    }
  }

  async function handleDelete() {
    try {
      await api.del(`/projects/${project.id}`);
      push(`${project.name} deleted`, "success");
      navigate("/");
    } catch (err) {
      setConfirmDelete(false);
      push(err.message, "error");
    }
  }

  return (
    <>
      <Modal
        title="Project settings"
        onClose={onClose}
        width="520px"
        footer={
          <>
            <button type="button" className="btn" onClick={onClose}>Close</button>
            <button
              className={`btn btn-primary${saving ? " is-loading" : ""}`}
              form="project-settings-form"
              type="submit"
              disabled={saving || !dirty || !name.trim()}
              aria-busy={saving}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </>
        }
      >
        {error && <Alert>{error}</Alert>}
        <form id="project-settings-form" onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="ps-name">Project name</label>
            <input id="ps-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} required />
          </div>
          <div className="field">
            <label htmlFor="ps-desc">Description</label>
            <textarea id="ps-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </form>

        <div className="profile-section">
          <h3>Public share link</h3>
          <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
            Anyone with the link can view this graph without logging in. They can't edit anything or see comments, members, or activity.
          </p>
          {share?.enabled && (
            <div className="copy-row">
              <input aria-label="Share link" readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
              <button type="button" className="btn btn-sm" onClick={copyLink}>Copy</button>
            </div>
          )}
          <button type="button" className="btn btn-sm" onClick={toggleShare} disabled={shareBusy || share === null}>
            {share?.enabled ? "Turn off sharing" : "Create share link"}
          </button>
        </div>

        <div className="profile-section">
          <h3>{archived ? "Archived" : "Archive"}</h3>
          <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
            {archived
              ? "This project is archived. Restore it to mark it active again."
              : "Archiving marks the project as inactive. Nothing is deleted, and you can restore it any time."}
          </p>
          <button type="button" className="btn btn-sm" onClick={toggleArchive} disabled={archiving}>
            {archived ? "Restore project" : "Archive project"}
          </button>
        </div>

        <div className="profile-section">
          <h3>Delete project</h3>
          <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
            {isOwner
              ? "Permanently deletes the project, its graph, comments, and history. This can't be undone."
              : "Only the project owner can delete this project."}
          </p>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)} disabled={!isOwner}>
            Delete project
          </button>
        </div>
      </Modal>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${project.name}" and everything in it? This cannot be undone.`}
          confirmLabel="Delete project"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </>
  );
}
