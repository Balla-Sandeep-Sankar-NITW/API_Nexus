import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Alert from "../components/ui/Alert";
import AuthLayout from "../components/AuthLayout";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      await register(email, fullName, password);
      navigate("/");
    } catch (err) {
      setError(err.message || "Could not create account");
    } finally {
      setSubmitting(false);
    }
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
