import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function ShareLinkModal({ projectId, onClose }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    api.get(`/projects/${projectId}/share`).then(setStatus).catch((err) => push(err.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const url = status?.share_token ? `${window.location.origin}/share/${status.share_token}` : null;

  async function handleEnable() {
    setLoading(true);
    try {
      const res = await api.post(`/projects/${projectId}/share`, {});
      setStatus(res);
      push("Share link created", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleRevoke() {
    setLoading(true);
    try {
      const res = await api.del(`/projects/${projectId}/share`);
      setStatus(res);
      push("Share link revoked", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  }

  function copyLink() {
    if (!url) return;
    navigator.clipboard.writeText(url).then(() => push("Link copied", "success"));
  }

  return (
    <Modal title="Share this graph" onClose={onClose} width="460px">
      {status === null ? (
        <div className="loading-row"><span className="spinner" />Loading…</div>
      ) : status.enabled ? (
        <div>
          <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
            Anyone with this link can view a read-only copy of the graph — no login required. They cannot edit,
            comment, or see members and activity.
          </p>
          <div className="field">
            <input value={url} readOnly onClick={(e) => e.target.select()} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-sm" onClick={copyLink}>Copy link</button>
            <button className="btn btn-sm btn-danger" onClick={handleRevoke} disabled={loading}>
              {loading ? "Revoking…" : "Revoke link"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
            Sharing is off. Enable it to generate a public, read-only link to this graph.
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleEnable} disabled={loading}>
            {loading ? "Enabling…" : "Enable sharing"}
          </button>
        </div>
      )}
    </Modal>
  );
}
