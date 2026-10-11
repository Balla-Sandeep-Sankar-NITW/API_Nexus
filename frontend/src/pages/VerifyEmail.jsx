import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";
import LoadingRow from "../components/ui/LoadingRow";
import { getAccessToken } from "../api/client";

// Landing page for the link in the verification email: /verify-email?token=...
export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get("token");
  const { verifyEmail, refreshUser, resendVerificationByEmail } = useAuth();
  const { push } = useToast();
  const [state, setState] = useState(token ? "verifying" : "missing"); // verifying | done | failed | missing
  const [error, setError] = useState("");
  const ranRef = useRef(false);

  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [devToken, setDevToken] = useState(null);

  useEffect(() => {
    // The token is single-use; guard so StrictMode's double effect run
    // doesn't spend it twice and report a false failure.
    if (!token || ranRef.current) return;
    ranRef.current = true;
    verifyEmail(token)
      .then(async () => {
        setState("done");
        // If they're already signed in, update the "not verified" banner.
        if (getAccessToken()) await refreshUser().catch(() => {});
      })
      .catch((err) => {
        setError(err.message || "This verification link is invalid or has expired.");
        setState("failed");
      });
  }, [token, verifyEmail, refreshUser]);

  async function handleResend(e) {
    e.preventDefault();
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

  return (
    <AuthLayout>
      {state === "verifying" && (
        <>
          <h1>Verifying your email</h1>
          <LoadingRow>Checking your link…</LoadingRow>
        </>
      )}

      {state === "done" && (
        <>
          <h1>Email verified</h1>
          <p className="auth-lede">Your account is ready. Log in to start mapping your APIs.</p>
          <Link to={getAccessToken() ? "/" : "/login"} className="btn btn-primary btn-block">
            {getAccessToken() ? "Continue to projects" : "Log in"}
          </Link>
        </>
      )}

      {(state === "failed" || state === "missing") && (
        <>
          <h1>Couldn't verify this link</h1>
          <Alert>
            {state === "missing"
              ? "This link is missing its verification token. Open the full link from your email."
              : error}
          </Alert>
          <p className="auth-lede">Enter your email and we'll issue a new verification link.</p>
          <form onSubmit={handleResend}>
            <div className="field">
              <label htmlFor="resend-email">Email</label>
              <input
                id="resend-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-block" disabled={resending}>
              {resending ? "Sending…" : "Send a new link"}
            </button>
          </form>
          {devToken && (
            <div className="notice">
              <strong>Email isn't configured on this server.</strong> Use this link instead:
              <div>
                <a href={`/verify-email?token=${encodeURIComponent(devToken)}`}>Verify now</a>
              </div>
            </div>
          )}
          <p className="auth-switch">
            <Link to="/login">Back to log in</Link>
          </p>
        </>
      )}
    </AuthLayout>
  );
}
