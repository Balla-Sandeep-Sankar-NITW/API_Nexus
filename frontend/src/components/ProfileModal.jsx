import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

export default function ProfileModal({ onClose }) {
  const { user, refreshUser } = useAuth();
  const { push } = useToast();
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [devToken, setDevToken] = useState(null);

  useEffect(() => {
    api.get("/auth/login-history").then(setHistory).catch(() => setHistory([]));
  }, []);

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch("/auth/me", { full_name: fullName });
      await refreshUser();
      push("Profile updated", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  const [emailSent, setEmailSent] = useState(null);

  async function handleResendVerification() {
    setVerifying(true);
    try {
      const res = await api.post("/auth/resend-verification", {});
      setEmailSent(res.email_sent);
      if (res.email_sent) {
        push("Verification email sent — check your inbox", "success");
      } else {
        // No SMTP configured on the backend - fall back to a direct link
        // instead of a real email.
        setDevToken(res.verification_token);
      }
    } catch (err) {
      push(err.message, "error");
    } finally {
      setVerifying(false);
    }
  }

  async function handleVerifyNow() {
    if (!devToken) return;
    try {
      await api.post("/auth/verify-email", { token: devToken });
      await refreshUser();
      push("Email verified", "success");
      setDevToken(null);
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <Modal title="Your profile" onClose={onClose} width="440px">
      <form onSubmit={handleSave}>
        <div className="field">
          <label htmlFor="profile-name">Full name</label>
          <input id="profile-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        </div>
        <div className="field">
          <label>Email</label>
          <input value={user?.email || ""} disabled />
        </div>
        <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="detail-section" style={{ padding: "16px 0", marginTop: 16 }}>
        <div className="detail-label">Verification</div>
        {user?.is_verified ? (
          <span className="badge badge-green"><span className="badge-dot" />Verified</span>
        ) : (
          <>
            <span className="badge badge-amber" style={{ marginBottom: 8 }}><span className="badge-dot" />Not verified</span>
            <div style={{ marginTop: 8 }}>
              <button className="btn btn-sm" onClick={handleResendVerification} disabled={verifying}>
                {verifying ? "Sending…" : "Send verification email"}
              </button>
              {emailSent === true && (
                <div className="field-hint" style={{ marginTop: 8 }}>
                  Sent — open the link in that email to verify. It's valid until you request a new one.
                </div>
              )}
              {devToken && (
                <div className="field-hint" style={{ marginTop: 8 }}>
                  This server has no email provider configured (see <code>SMTP_HOST</code> in the backend .env),
                  so here's a direct link instead of an email:
                  <div style={{ marginTop: 6 }}>
                    <button className="btn btn-sm btn-primary" onClick={handleVerifyNow}>Verify now</button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="detail-section" style={{ padding: "16px 0" }}>
        <div className="detail-label">Recent logins</div>
        {history === null && <div className="loading-row"><span className="spinner" />Loading…</div>}
        {history && history.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>No login history yet.</p>}
        {history && history.slice(0, 8).map((h) => (
          <div key={h.id} className="detail-row">
            <span className="k">{new Date(h.created_at).toLocaleString()}</span>
            <span className="v">{h.success ? "Success" : "Failed"}</span>
          </div>
        ))}
      </div>
    </Modal>
  );
}
