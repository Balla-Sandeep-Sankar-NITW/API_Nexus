import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { register } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { message, email_sent, verification_token }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setSubmitting(true);
    try {
      const res = await register(email, fullName, password);
      setResult(res);
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <div className="auth-brand">API Nexus</div>
          <div className="auth-tagline">One more step</div>
          <p style={{ fontSize: 13, color: "var(--ink-700)" }}>{result.message}</p>
          <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
            You won't be able to log in until this account is verified.
          </p>
          {result.email_sent && (
            <p style={{ fontSize: 12.5, color: "var(--status-green)" }}>
              Check your inbox at {email} for the verification link.
            </p>
          )}
          {result.verification_token && (
            <div className="field-hint" style={{ marginBottom: 14 }}>
              This server has no email provider configured (see <code>SMTP_HOST</code> in the backend .env),
              so here's a direct link instead of an email:
              <div style={{ marginTop: 6 }}>
                <Link to={`/verify-email?token=${result.verification_token}`} className="btn btn-sm btn-primary">
                  Verify now
                </Link>
              </div>
            </div>
          )}
          <div className="auth-switch">
            <Link to="/login">Back to log in</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">API Nexus</div>
        <div className="auth-tagline">Create your account</div>
        {error && <div className="auth-error">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="fullName">Full name</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Sandeep Rao"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" style={{ width: "100%" }} disabled={submitting}>
            {submitting ? "Creating account…" : "Create account"}
          </button>
        </form>
        <div className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  );
}
