import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Alert from "./ui/Alert";
import PasswordField from "./ui/PasswordField";

// Password: change it (or set one, for accounts created with GitHub), or get a reset email.
export function PasswordSection({ onClose }) {
  const { user, changePassword, requestPasswordReset } = useAuth();
  const { push } = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasPassword = user?.password_set !== false;

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (next.length < 8) return setError("Use at least 8 characters.");
    setBusy(true);
    try {
      await changePassword(hasPassword ? current : null, next);
      push(hasPassword ? "Password changed. Other devices were signed out." : "Password set", "success");
      setOpen(false); setCurrent(""); setNext("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function emailReset() {
    try {
      await requestPasswordReset(user.email);
      push(`If email is set up, a reset link is on its way to ${user.email}`, "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <div className="profile-section">
      <h3>Password</h3>
      {!open ? (
        <div className="profile-actions">
          <button type="button" className="btn btn-sm" onClick={() => setOpen(true)}>
            {hasPassword ? "Change password" : "Set a password"}
          </button>
          {hasPassword && <button type="button" className="btn btn-sm btn-ghost" onClick={emailReset}>Email me a reset link</button>}
        </div>
      ) : (
        <form onSubmit={submit} className="inline-form">
          {error && <Alert>{error}</Alert>}
          {hasPassword && (
            <PasswordField label="Current password" value={current} onChange={setCurrent} autoFocus />
          )}
          <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" showStrength autoFocus={!hasPassword} />
          <div className="profile-actions">
            <button type="submit" className={`btn btn-sm btn-primary${busy ? " is-loading" : ""}`} disabled={busy}>
              {busy ? "Saving…" : "Save password"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => { setOpen(false); setError(""); }}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

export function SessionsSection() {
  const { logoutEverywhere } = useAuth();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      await logoutEverywhere();
      push("Signed out everywhere else. This device stays signed in.", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="profile-section">
      <h3>Sessions</h3>
      <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>Lost a device or used a shared computer? End every other session.</p>
      <button type="button" className={`btn btn-sm${busy ? " is-loading" : ""}`} onClick={run} disabled={busy}>
        {busy ? "Signing out…" : "Sign out other devices"}
      </button>
    </div>
  );
}

export function DataSection({ onClose }) {
  const { user, deleteAccount } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasPassword = user?.password_set !== false;

  async function download() {
    setExporting(true);
    try {
      const data = await api.get("/auth/export");
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `api-nexus-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      push("Your data was downloaded", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setExporting(false);
    }
  }

  async function remove(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await deleteAccount(email, password);
      onClose();
      navigate("/login");
      push("Your account was deleted", "success");
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="profile-section">
      <h3>Your data</h3>
      <div className="profile-actions">
        <button type="button" className={`btn btn-sm${exporting ? " is-loading" : ""}`} onClick={download} disabled={exporting}>
          {exporting ? "Preparing…" : "Download my data"}
        </button>
        {!confirming && (
          <button type="button" className="btn btn-sm btn-danger" onClick={() => setConfirming(true)}>Delete account</button>
        )}
      </div>
      {confirming && (
        <form onSubmit={remove} className="danger-zone">
          <p>
            This deletes your profile, comments and sign-in history. Projects you own move to another leader if one
            exists; otherwise they are deleted with everything in them. This can't be undone.
          </p>
          {error && <Alert>{error}</Alert>}
          <div className="field">
            <label htmlFor="del-email">Type <strong>{user?.email}</strong> to confirm</label>
            <input id="del-email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" required />
          </div>
          {hasPassword && <PasswordField id="del-pass" label="Your password" value={password} onChange={setPassword} />}
          <div className="profile-actions">
            <button type="submit" className={`btn btn-sm btn-danger-solid${busy ? " is-loading" : ""}`} disabled={busy || email.trim().toLowerCase() !== user?.email?.toLowerCase()}>
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => { setConfirming(false); setError(""); }}>Keep my account</button>
          </div>
        </form>
      )}
    </div>
  );
}
