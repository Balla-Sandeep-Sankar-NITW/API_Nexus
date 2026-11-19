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
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/$/, "");

const BASE_URL = API_BASE_URL;

// ---------- Activity signals for the UI ----------
// The top progress bar and the "server is waking up" banner listen to these. Background
// polling (notifications) is excluded so it never flashes the bar.
let inFlight = 0;
function busyStart(track) {
  if (!track) return () => {};
  inFlight += 1;
  window.dispatchEvent(new CustomEvent("api:busy", { detail: inFlight }));
  return () => {
    inFlight = Math.max(0, inFlight - 1);
    window.dispatchEvent(new CustomEvent("api:busy", { detail: inFlight }));
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Exchange the refresh token for a fresh pair. One in-flight request is shared
// so a burst of 401s only triggers a single refresh.
let refreshInFlight = null;
function refreshTokens() {
  const refresh = getRefreshToken();
  if (!refresh) return Promise.resolve(false);
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
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
  const done = busyStart(!path.startsWith("/me/notifications"));
  try {
    return await send(path, { method, body, auth }, retried);
  } finally {
    done();
  }
}

async function send(path, { method, body, auth }, retried) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getAccessToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }

  // A sleeping free-tier server can answer 502/503/504 while it wakes. Reads are safe to retry.
  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      if (method === "GET" && attempt < 2) {
        await sleep(1500 * (attempt + 1));
        continue;
      }
      throw new ApiError("Can't reach the server. Check your connection and try again.", 0, null);
    }
    if (method === "GET" && [502, 503, 504].includes(res.status) && attempt < 2) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    break;
  }

  // Expired access token: try the refresh token once, then replay the request.
  if (res.status === 401 && auth && !retried && getRefreshToken()) {
    if (await refreshTokens()) return send(path, { method, body, auth }, true);
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
    let message = data?.detail || res.statusText || "Request failed";
    // FastAPI validation errors arrive as a list; show the first message in plain words.
    if (Array.isArray(message)) message = message[0]?.msg?.replace(/^Value error, /, "") || "Please check the form and try again.";
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
