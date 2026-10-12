import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";

export default function ForgotPassword() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null); // { message, email_sent, reset_token? }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      setResult(await requestPasswordReset(email));
    } catch (err) {
      setError(err.message || "Could not request a password reset");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <AuthLayout>
        <h1>Check your email</h1>
        <p className="auth-lede">{result.message} The link expires in 30 minutes.</p>
        {result.reset_token && (
          <div className="notice">
            <strong>Email isn't configured on this server.</strong> Use this link to reset your password:
            <div>
              <Link to={`/reset-password?token=${encodeURIComponent(result.reset_token)}`}>Reset password</Link>
            </div>
          </div>
        )}
        <Link to="/login" className="btn btn-block">Back to log in</Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h1>Reset your password</h1>
      <p className="auth-lede">Enter your account email and we'll send you a link to choose a new password.</p>
      {error && <Alert>{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            required
            autoFocus
          />
        </div>
        <button className={`btn btn-primary btn-block${submitting ? " is-loading" : ""}`} type="submit" disabled={submitting} aria-busy={submitting}>
          {submitting ? "Sending…" : "Send reset link"}
        </button>
      </form>
      <p className="auth-switch">
        <Link to="/login">Back to log in</Link>
      </p>
    </AuthLayout>
  );
}
