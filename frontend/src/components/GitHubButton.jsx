import { useEffect, useState } from "react";
import { API_BASE_URL, api } from "../api/client";

let cached = null;
// Which sign-in options this server has. Cached so moving between login and register is instant.
export function useAuthConfig() {
  const [config, setConfig] = useState(cached);
  useEffect(() => {
    if (cached) return;
    api.get("/auth/config", { auth: false }).then((c) => { cached = c; setConfig(c); }).catch(() => {});
  }, []);
  return config;
}

// Always shown. If the server says GitHub isn't set up, the click explains that instead of
// sending people to an error page. While the answer is unknown (server waking up), the click goes through.
export default function GitHubButton({ label = "Continue with GitHub" }) {
  const config = useAuthConfig();
  const [notice, setNotice] = useState("");

  function onClick(e) {
    if (config && config.github === false) {
      e.preventDefault();
      setNotice("GitHub sign-in isn't turned on for this site yet. Please use your email for now.");
      console.warn("GitHub sign-in is off: set GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and BACKEND_BASE_URL on the backend.");
    }
  }

  return (
    <div className="github-block">
      <div className="auth-divider"><span>or</span></div>
      <a className="btn btn-block btn-github" href={`${API_BASE_URL}/auth/github/login`} onClick={onClick}>
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {label}
      </a>
      {notice && <div className="notice notice-warn" role="status" style={{ marginTop: "var(--sp-3)" }}>{notice}</div>}
    </div>
  );
}
