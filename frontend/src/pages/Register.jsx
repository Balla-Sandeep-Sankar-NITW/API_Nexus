import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const { register, resendVerificationByEmail } = useAuth();
  const { push } = useToast();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState(null); // { email, email_sent, verification_token }
  const [resending, setResending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setPasswordError("");
    if (password.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await register(email, fullName, password);
      setCreated({ email, ...result });
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    try {
      const result = await resendVerificationByEmail(created.email);
      setCreated((c) => ({ ...c, email_sent: result.email_sent, verification_token: result.verification_token }));
      push(result.email_sent ? "Verification email sent" : "Verification link refreshed", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setResending(false);
    }
  }

  if (created) {
    return (
      <AuthLayout>
        <h1>Check your email</h1>
        <p className="auth-lede">
          We created your account. Open the verification link we sent to <strong>{created.email}</strong>, then log in.
        </p>
        {!created.email_sent && created.verification_token && (
          <div className="notice">
            <strong>Email isn't configured on this server.</strong> Use this link to verify instead:
            <div>
              <Link to={`/verify-email?token=${encodeURIComponent(created.verification_token)}`}>Verify {created.email}</Link>
            </div>
          </div>
        )}
        <div className="auth-actions">
          <Link to="/login" className="btn btn-primary btn-block">Go to log in</Link>
          <button type="button" className="btn btn-block" onClick={handleResend} disabled={resending}>
            {resending ? "Sending…" : "Send the link again"}
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Create account</h1>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="fullName">Full name</label>
          <input
            id="fullName"
            autoComplete="name"
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
            autoComplete="email"
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
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordError ? "true" : undefined}
            aria-describedby="password-help"
            required
          />
          {passwordError ? (
            <div id="password-help" className="field-error" role="alert">{passwordError}</div>
          ) : (
            <div id="password-help" className="field-hint">At least 8 characters.</div>
          )}
        </div>
        <button
          className={`btn btn-primary btn-block${submitting ? " is-loading" : ""}`}
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
