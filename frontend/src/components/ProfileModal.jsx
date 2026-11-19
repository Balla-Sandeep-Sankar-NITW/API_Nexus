import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { PasswordSection, SessionsSection, DataSection } from "./AccountSecurity";

// Account settings. Only wired to endpoints the backend actually exposes:
// PATCH /api/auth/me updates full_name (not email - there's no endpoint for
// that), and verification / password reset reuse the same requests the
// register and forgot-password flows already use.
export default function ProfileModal({ onClose }) {
  const { user, updateProfile, resendVerification } = useAuth();
  const { push } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [devVerifyToken, setDevVerifyToken] = useState(null);
  const [history, setHistory] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Sign-in history is only fetched once it's opened.
  useEffect(() => {
    if (!showHistory || history !== null) return;
    api.get("/auth/login-history").then(setHistory).catch(() => setHistory([]));
  }, [showHistory, history]);

  const dirty = fullName.trim() !== "" && fullName.trim() !== user?.full_name;

  async function handleSave(e) {
    e.preventDefault();
    if (!dirty) return;
    setError("");
    setSaving(true);
    try {
      await updateProfile(fullName.trim());
      push("Profile updated", "success");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleResendVerification() {
    setVerifying(true);
    try {
      const result = await resendVerification();
      // Without SMTP the backend hands back the token instead of emailing it.
      setDevVerifyToken(result?.verification_token || null);
      if (result?.email_sent) push("Verification email sent", "success");
      else if (result?.verification_token) push("Email isn't set up on this server. Use the link below to verify.", "default");
      else push("Could not send verification email", "error");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Modal
      title="Profile settings"
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Close</button>
          <button
            className={`btn btn-primary${saving ? " is-loading" : ""}`}
            form="profile-form"
            type="submit"
            disabled={saving || !dirty}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <form id="profile-form" onSubmit={handleSave}>
        <div className="field">
          <label htmlFor="profile-name">Full name</label>
          <input
            id="profile-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            maxLength={120}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input id="profile-email" value={user?.email || ""} disabled />
          <div className="field-hint">
            Your email is your sign-in name, so it can't be changed here.
          </div>
        </div>
      </form>

      <div className="profile-status">
        <div className="profile-status-row">
          {user?.is_verified ? (
            <span className="badge badge-green"><span className="badge-dot" aria-hidden="true" />Email verified</span>
          ) : (
            <span className="badge badge-amber"><span className="badge-dot" aria-hidden="true" />Email not verified</span>
          )}
          {!user?.is_verified && (
            <button type="button" className="btn btn-sm" onClick={handleResendVerification} disabled={verifying}>
              {verifying ? "Sending…" : "Resend verification"}
            </button>
          )}
        </div>
        {devVerifyToken && (
          <div className="notice">
            Email isn't set up on this server.{" "}
            <Link to={`/verify-email?token=${encodeURIComponent(devVerifyToken)}`} onClick={onClose}>Verify now</Link>
          </div>
        )}
      </div>

      <PasswordSection onClose={onClose} />

      <div className="profile-section">
        <h3>Sign-in history</h3>
        <button type="button" className="btn btn-sm" aria-expanded={showHistory} onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide sign-in history" : "Show sign-in history"}
        </button>
        {showHistory && history === null && <p className="field-hint" style={{ margin: "var(--sp-3) 0 0" }}>Loading…</p>}
        {showHistory && history && history.length === 0 && <p className="field-hint" style={{ margin: 0 }}>No sign-ins recorded yet.</p>}
        {showHistory && history && history.length > 0 && (
          <ul className="history-list" style={{ marginTop: "var(--sp-3)" }}>
            {history.slice(0, 8).map((h) => (
              <li key={h.id}>
                <span className={`badge ${h.success ? "badge-green" : "badge-red"}`}>
                  <span className="badge-dot" aria-hidden="true" />
                  {h.success ? "Signed in" : "Failed attempt"}
                </span>
                <span className="text-muted tabular">{new Date(h.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <SessionsSection />
      <DataSection onClose={onClose} />
    </Modal>
  );
}
