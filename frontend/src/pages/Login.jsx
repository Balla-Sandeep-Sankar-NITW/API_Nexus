import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api } from "../api/client";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendResult, setResendResult] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setResendResult(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not log in");
      if (err.status === 403 && /verify/i.test(err.message || "")) {
        setNeedsVerification(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const res = await api.post("/auth/resend-verification-by-email", { email }, { auth: false });
      setResendResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">API Nexus</div>
        <div className="auth-tagline">Log in to your workspace</div>
        {error && <div className="auth-error">{error}</div>}

        {needsVerification && (
          <div style={{ marginBottom: 14 }}>
            {!resendResult ? (
              <button className="btn btn-sm" onClick={handleResend} disabled={resending || !email}>
                {resending ? "Sending…" : "Resend verification link"}
              </button>
            ) : resendResult.email_sent ? (
              <p style={{ fontSize: 12.5, color: "var(--status-green)" }}>
                Check your inbox at {email} for the verification link.
              </p>
            ) : resendResult.verification_token ? (
              <div className="field-hint">
                No email provider is configured on this server — use this link instead:
                <div style={{ marginTop: 6 }}>
                  <Link to={`/verify-email?token=${resendResult.verification_token}`} className="btn btn-sm btn-primary">
                    Verify now
                  </Link>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>{resendResult.message}</p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <div className="field-hint" style={{ textAlign: "right" }}>
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <div className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </div>
      </div>
    </div>
  );
}
