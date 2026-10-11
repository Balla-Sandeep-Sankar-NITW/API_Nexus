import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";

// Landing page for the link in the reset email: /reset-password?token=...
export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { resetPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err) {
      setError(err.message || "Could not reset your password");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <h1>Reset link incomplete</h1>
        <Alert>This link is missing its reset token. Open the full link from your email, or request a new one.</Alert>
        <Link to="/forgot-password" className="btn btn-primary btn-block">Request a new link</Link>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <h1>Password updated</h1>
        <p className="auth-lede">You can now log in with your new password.</p>
        <Link to="/login" className="btn btn-primary btn-block">Log in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Choose a new password</h1>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <div className="field-hint">At least 8 characters.</div>
        </div>
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        <button className={`btn btn-primary btn-block${submitting ? " is-loading" : ""}`} type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Updating…" : "Update password"}
        </button>
      </form>
      <p className="auth-switch">
        Link expired? <Link to="/forgot-password">Request a new one</Link>
      </p>
    </AuthLayout>
  );
}
