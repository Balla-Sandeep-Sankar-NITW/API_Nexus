const TOKEN_KEY = "api_nexus_access_token";
const REFRESH_KEY = "api_nexus_refresh_token";

export function getAccessToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access, refresh) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

// Backend base URL: set VITE_API_BASE_URL in .env for a deployed backend.
// Falls back to "/api", which relies on a same-origin reverse proxy (the
// Vite dev server proxy locally, or your web server's config in production).
const BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

// Exchange the refresh token for a fresh pair. One in-flight request is shared
// so a burst of 401s only triggers a single refresh. The backend takes the
// refresh token as a query parameter (POST /auth/refresh?refresh_token=...).
let refreshInFlight = null;
function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh?refresh_token=${encodeURIComponent(refresh)}`, { method: "POST" })
      .then(async (res) => {
        if (!res.ok) return false;
        const data = await res.json();
        setTokens(data.access_token, data.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

async function request(path, { method = "GET", body, auth = true } = {}, retried = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    throw new ApiError("Cannot reach the API Nexus server. Is the backend running?", 0, null);
  }

  // Expired access token: try the refresh token once, then replay the request.
  // If that fails the session is over; tell the app so it can show the login page.
  if (res.status === 401 && auth && !retried && getRefreshToken()) {
    if (await refreshTokens()) return request(path, { method, body, auth }, true);
    clearTokens();
    window.dispatchEvent(new Event("auth:expired"));
  }

  if (res.status === 204) return null;

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const message = data?.detail || res.statusText || "Request failed";
    throw new ApiError(typeof message === "string" ? message : "Request failed", res.status, data?.detail);
  }
  return data;
}

export const api = {
  get: (path, opts) => request(path, opts),
  post: (path, body, opts) => request(path, { method: "POST", body, ...opts }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path) => request(path, { method: "DELETE" }),
};

export { ApiError };
