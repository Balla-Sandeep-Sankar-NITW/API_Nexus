// Pure helpers for the API Explorer: building the request from the form, applying the
// chosen credentials, masking secrets for copy/paste, and presenting responses.

export const opKey = (op) => `${op.method} ${op.path}`;
export const paramKey = (p) => `${p.in}:${p.name}`;

// ---------- credentials (kept only for this browser tab, cleared on log out) ----------
const credsKey = (projectId) => `apiNexus.explorer.auth.${projectId}`;

export function loadCreds(projectId) {
  try {
    return JSON.parse(sessionStorage.getItem(credsKey(projectId)) || "{}");
  } catch {
    return {};
  }
}
export function saveCreds(projectId, creds) {
  try {
    sessionStorage.setItem(credsKey(projectId), JSON.stringify(creds));
  } catch {
    /* storage unavailable: credentials just won't survive a reload */
  }
}
export function clearAllCreds() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith("apiNexus.explorer.auth."))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

const hasCred = (scheme, creds) => {
  const c = creds?.[scheme.name];
  if (!c) return false;
  return scheme.kind === "basic" ? Boolean(c.username || c.password) : Boolean((c.value || "").trim());
};

// ---------- URL ----------
// Substitutes {placeholders} in the path and appends the query. Reports anything left unfilled.
export function buildUrl(baseUrl, path, pathValues, queryEntries) {
  const missing = [];
  const filled = path.replace(/\{([^}]+)\}/g, (_, name) => {
    const v = pathValues[name];
    if (v === undefined || String(v).trim() === "") {
      missing.push(name);
      return `{${name}}`;
    }
    return encodeURIComponent(String(v).trim());
  });
  const base = (baseUrl || "").trim().replace(/\/+$/, "");
  const qs = new URLSearchParams();
  for (const [k, v] of queryEntries) qs.append(k, v);
  const query = qs.toString();
  return { url: `${base}${filled}${query ? `?${query}` : ""}`, missing };
}

// Array-typed query parameters are entered comma-separated and sent as repeated keys (?tag=a&tag=b).
export function queryEntriesFor(params, values) {
  const out = [];
  for (const p of params.filter((x) => x.in === "query")) {
    const raw = (values[paramKey(p)] ?? "").toString();
    if (raw.trim() === "") continue;
    if (p.schema?.type === "array") raw.split(",").map((s) => s.trim()).filter(Boolean).forEach((v) => out.push([p.name, v]));
    else out.push([p.name, raw]);
  }
  return out;
}

// ---------- auth ----------
// An operation lists alternative security requirements; use the first one whose every scheme has credentials.
export function applyAuth(op, schemes, creds) {
  const byName = Object.fromEntries(schemes.map((s) => [s.name, s]));
  const result = { headers: {}, query: [], applied: [], secretHeaders: new Set(), secretQuery: new Set(), missing: [] };
  const alternatives = op.security || [];
  if (alternatives.length === 0) return result;
  const chosen = alternatives.find((req) => req.length > 0 && req.every((n) => byName[n] && hasCred(byName[n], creds)));
  if (!chosen) {
    if (op.auth_required) result.missing = alternatives[0].filter((n) => !byName[n] || !hasCred(byName[n], creds));
    return result;
  }
  for (const name of chosen) {
    const s = byName[name];
    const c = creds[name];
    if (s.kind === "bearer") {
      result.headers.Authorization = `Bearer ${c.value.trim()}`;
      result.secretHeaders.add("authorization");
    } else if (s.kind === "basic") {
      result.headers.Authorization = `Basic ${btoa(unescape(encodeURIComponent(`${c.username || ""}:${c.password || ""}`)))}`;
      result.secretHeaders.add("authorization");
    } else if (s.kind === "apikey") {
      const where = s.in || "header";
      if (where === "query") {
        result.query.push([s.param_name, c.value.trim()]);
        result.secretQuery.add(s.param_name);
      } else if (where === "cookie") {
        result.headers.Cookie = `${s.param_name}=${c.value.trim()}`;
        result.secretHeaders.add("cookie");
      } else {
        result.headers[s.param_name] = c.value.trim();
        result.secretHeaders.add(s.param_name.toLowerCase());
      }
    }
    result.applied.push(name);
  }
  return result;
}

// ---------- body ----------
export const isJsonType = (ct) => /(^|\/|\+)json\b/i.test(ct || "");

export function bodyForSend(contentType, text) {
  const ct = (contentType || "").toLowerCase();
  if (text === undefined || text.trim() === "") return { body: null };
  if (ct.startsWith("application/x-www-form-urlencoded")) {
    try {
      const obj = JSON.parse(text);
      if (obj && typeof obj === "object" && !Array.isArray(obj)) {
        const usp = new URLSearchParams();
        for (const [k, v] of Object.entries(obj)) usp.append(k, typeof v === "object" ? JSON.stringify(v) : String(v ?? ""));
        return { body: usp.toString() };
      }
    } catch {
      /* not JSON: send as typed (already key=value&...) */
    }
    return { body: text };
  }
  if (isJsonType(ct)) {
    try {
      JSON.parse(text);
    } catch (e) {
      return { error: `The JSON body isn't valid: ${e.message}` };
    }
  }
  return { body: text };
}

export function examplesToText(contentType, example) {
  if (example === null || example === undefined) return "";
  if (typeof example === "string" && !isJsonType(contentType)) return example;
  return JSON.stringify(example, null, 2);
}

// ---------- copy as cURL (secrets masked) ----------
const q = (s) => `'${String(s).replace(/'/g, "'\\''")}'`;

export function buildCurl({ method, url, headers, body }, { secretHeaders = new Set(), secretQuery = new Set() } = {}) {
  let safeUrl = url;
  try {
    const u = new URL(url);
    for (const name of secretQuery) if (u.searchParams.has(name)) u.searchParams.set(name, "<redacted>");
    safeUrl = u.toString().replace(/%3Credacted%3E/g, "<redacted>");
  } catch {
    /* leave as is */
  }
  const parts = ["curl", "-X", method, q(safeUrl)];
  for (const [k, v] of Object.entries(headers)) {
    parts.push("-H", q(`${k}: ${secretHeaders.has(k.toLowerCase()) ? "<redacted>" : v}`));
  }
  if (body) parts.push("--data-raw", q(body));
  return parts.join(" ");
}

// ---------- response ----------
// Is this status documented for the operation? Matches "200", "2XX" and "default".
export function statusDocumented(op, status) {
  const codes = (op.responses || []).map((r) => r.status.toUpperCase());
  return codes.includes(String(status)) || codes.includes(`${Math.floor(status / 100)}XX`) || codes.includes("DEFAULT");
}

export function statusTone(status) {
  if (status >= 500) return "red";
  if (status >= 400) return "amber";
  if (status >= 300) return "teal";
  return "green";
}

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function prettyBody(body, contentType) {
  if (body == null) return "";
  if (isJsonType(contentType) || /^\s*[[{]/.test(body)) {
    try {
      return JSON.stringify(JSON.parse(body), null, 2);
    } catch {
      return body;
    }
  }
  return body;
}

// Splits pretty JSON into [{ text, kind }] so it can be coloured without ever using innerHTML.
const TOKEN = /("(?:\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g;
export function tokenizeJson(text) {
  const out = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    if (m.index > last) out.push({ text: text.slice(last, m.index), kind: "plain" });
    const t = m[0];
    const kind = t.startsWith('"') ? (m[2] ? "key" : "string") : /^(true|false)$/.test(t) ? "bool" : t === "null" ? "null" : "number";
    out.push({ text: t, kind });
    last = m.index + t.length;
  }
  if (last < text.length) out.push({ text: text.slice(last), kind: "plain" });
  return out;
}

// ---------- remembered base URL (not a secret) ----------
const baseKey = (projectId) => `apiNexus.explorer.base.${projectId}`;
export const loadBaseUrl = (projectId) => {
  try {
    return localStorage.getItem(baseKey(projectId)) || "";
  } catch {
    return "";
  }
};
export const saveBaseUrl = (projectId, url) => {
  try {
    localStorage.setItem(baseKey(projectId), url);
  } catch {
    /* ignore */
  }
};
