import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await api.post("/auth/request-password-reset", { email }, { auth: false });
      setSubmitted(true);
      setEmailSent(res.email_sent);
      // Only populated when no SMTP is configured on the backend - once
      // real email delivery works, reset_token is never in this response.
      setDevToken(res.reset_token);
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
        <div className="auth-tagline">Reset your password</div>
        {error && <div className="auth-error">{error}</div>}

        {!submitted ? (
          <form onSubmit={handleSubmit}>
            <div className="field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
              {submitting ? "Sending…" : "Send reset link"}
            </button>
          </form>
        ) : (
          <div>
            <p style={{ fontSize: 13, color: "var(--ink-700)" }}>
              If an account with that email exists, a reset link has been issued.
            </p>
            {emailSent && (
              <p style={{ fontSize: 12.5, color: "var(--status-green)" }}>
                Check your inbox for the reset link — it expires in 30 minutes.
              </p>
            )}
            {devToken && (
              <div className="field-hint" style={{ marginBottom: 14 }}>
                This server has no email provider configured (see <code>SMTP_HOST</code> in the backend .env),
                so here's a direct link instead of an email:
                <div style={{ marginTop: 6 }}>
                  <Link to={`/reset-password?token=${devToken}`} className="btn btn-sm btn-primary">
                    Continue to reset password
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="auth-switch">
          <Link to="/login">Back to log in</Link>
        </div>
      </div>
    </div>
  );
}
