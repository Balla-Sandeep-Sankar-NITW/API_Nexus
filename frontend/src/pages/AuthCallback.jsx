import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import Alert from "../components/ui/Alert";
import LoadingRow from "../components/ui/LoadingRow";

// The backend sends people here after GitHub sign-in, with the tokens in the URL fragment.
export default function AuthCallback() {
  const { loginWithTokens } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const access = params.get("access_token");
    const refresh = params.get("refresh_token");
    window.history.replaceState(null, "", window.location.pathname);   // tokens never stay in the address bar
    if (!access) {
      setError("Sign-in didn't complete. Please try again.");
      return;
    }
    loginWithTokens(access, refresh).then(() => navigate("/", { replace: true })).catch(() => setError("Could not finish signing you in."));
  }, [loginWithTokens, navigate]);

  return (
    <AuthLayout>
      {error ? (
        <>
          <h1>Sign-in problem</h1>
          <Alert>{error}</Alert>
          <Link to="/login" className="btn btn-primary btn-block">Back to log in</Link>
        </>
      ) : (
        <LoadingRow>Signing you in…</LoadingRow>
      )}
    </AuthLayout>
  );
}
