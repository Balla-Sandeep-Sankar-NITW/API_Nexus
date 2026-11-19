import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";
import PasswordField from "../components/ui/PasswordField";
import GitHubButton from "../components/GitHubButton";

export default function Login() {
  const { login, resendVerificationByEmail } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [params] = useSearchParams();
  const [error, setError] = useState(params.get("error") || "");
  const [submitting, setSubmitting] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [devToken, setDevToken] = useState(null);
  const [resending, setResending] = useState(false);

  async function handleResend() {
    setResending(true);
    try {
      const result = await resendVerificationByEmail(email);
      setDevToken(result.verification_token || null);
      push(result.message, "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setNeedsVerification(false);
    setDevToken(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not log in");
      // The backend answers 403 "Please verify your email..." for unverified accounts.
      setNeedsVerification(err.status === 403 && /verify/i.test(err.message || ""));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
        <h1>Log in</h1>
        {error && <Alert>{error}</Alert>}
        {needsVerification && (
          <div className="notice">
            <button type="button" className="btn btn-sm" onClick={handleResend} disabled={resending || !email}>
              {resending ? "Sending…" : "Send a new verification link"}
            </button>
            {devToken && (
              <div>
                Email isn't set up on this server. <Link to={`/verify-email?token=${encodeURIComponent(devToken)}`}>Verify now</Link>
              </div>
            )}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              aria-invalid={error ? "true" : undefined}
              required
              autoFocus
            />
          </div>
          <PasswordField id="password" label="Password" value={password} onChange={setPassword} error={undefined} />
          <div className="field-hint field-hint--tight"><Link to="/forgot-password">Forgot your password?</Link></div>
          <button
            className={`btn btn-primary btn-block${submitting ? " is-loading" : ""}`}
            type="submit"
            disabled={submitting}
            aria-busy={submitting}
          >
            {submitting ? "Logging in…" : "Log in"}
          </button>
        </form>
        <GitHubButton />
        <p className="auth-switch">
          Don't have an account? <Link to="/register">Create one</Link>
        </p>
    </AuthLayout>
  );
}
