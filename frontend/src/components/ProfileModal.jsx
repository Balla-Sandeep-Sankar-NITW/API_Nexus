import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { ApiError } from "../api/client";

// Account settings. Only wired to endpoints the backend actually exposes:
// PATCH /api/auth/me updates full_name (not email - there's no endpoint for
// that), and verification / password reset reuse the same requests the
// register and forgot-password flows already use.
export default function ProfileModal({ onClose }) {
  const { user, updateProfile, resendVerification, requestPasswordReset } = useAuth();
  const { push } = useToast();

  const [fullName, setFullName] = useState(user?.full_name || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);

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
      push(result?.email_sent ? "Verification email sent" : "Could not send verification email", result?.email_sent ? "success" : "error");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setVerifying(false);
    }
  }

  async function handlePasswordReset() {
    setResetting(true);
    try {
      const result = await requestPasswordReset(user.email);
      push(result?.message || "If that email is registered, a reset link was sent", "success");
    } catch (err) {
      push(err instanceof ApiError ? err.message : "Could not request a password reset", "error");
    } finally {
      setResetting(false);
    }
  }

  return (
    <Modal
      title="Profile settings"
      onClose={onClose}
      width="440px"
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
            Email can't be changed from here yet. Contact an administrator if you need it updated.
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
      </div>

      <div className="profile-section">
        <h3>Password</h3>
        <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
          We'll email a reset link to {user?.email}.
        </p>
        <button type="button" className="btn btn-sm" onClick={handlePasswordReset} disabled={resetting}>
          {resetting ? "Sending…" : "Send password reset email"}
        </button>
      </div>
    </Modal>
  );
}
