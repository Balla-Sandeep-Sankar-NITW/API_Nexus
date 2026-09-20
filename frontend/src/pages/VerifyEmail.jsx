import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { user, refreshUser } = useAuth();
  const [status, setStatus] = useState("pending"); // pending | success | error
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("No verification token in the link. Copy the full link from your email.");
      return;
    }
    api
      .post("/auth/verify-email", { token }, { auth: false })
      .then(async () => {
        setStatus("success");
        if (user) await refreshUser().catch(() => {});
      })
      .catch((err) => {
        setStatus("error");
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">API Nexus</div>
        <div className="auth-tagline">Email verification</div>

        {status === "pending" && <p style={{ fontSize: 13 }}>Verifying…</p>}
        {status === "success" && (
          <p style={{ fontSize: 13, color: "var(--status-green)" }}>Your email is verified.</p>
        )}
        {status === "error" && <div className="auth-error">{error}</div>}

        <div className="auth-switch">
          <Link to={user ? "/" : "/login"}>{user ? "Back to dashboard" : "Back to log in"}</Link>
        </div>
      </div>
    </div>
  );
}
