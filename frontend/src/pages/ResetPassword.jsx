import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../api/client";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(searchParams.get("token") || "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password }, { auth: false });
      setDone(true);
      setTimeout(() => navigate("/login"), 1800);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">API Nexus</div>
        <div className="auth-tagline">Set a new password</div>
        {error && <div className="auth-error">{error}</div>}

        {done ? (
          <p style={{ fontSize: 13, color: "var(--status-green)" }}>Password updated. Redirecting to log in…</p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="token">Reset token</label>
              <input id="token" value={token} onChange={(e) => setToken(e.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 8 characters"
                required
                autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "Updating…" : "Update password"}
            </button>
          </form>
        )}
        <div className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}
