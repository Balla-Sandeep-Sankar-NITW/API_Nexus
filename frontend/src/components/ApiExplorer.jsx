import { useMemo, useState, useEffect } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import {
  applyAuth, bodyForSend, buildCurl, buildUrl, examplesToText, isJsonType, loadBaseUrl, loadCreds,
  opKey, paramKey, queryEntriesFor, saveBaseUrl, saveCreds,
} from "../utils/explorer";
import ExplorerAuth from "./explorer/ExplorerAuth";
import ExplorerResponse from "./explorer/ExplorerResponse";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

const GROUPS = [
  ["path", "Path parameters"],
  ["query", "Query parameters"],
  ["header", "Headers"],
  ["cookie", "Cookies"],
];

function initialForm(op) {
  const params = {};
  for (const p of op.parameters) params[paramKey(p)] = p.required ? String(p.example ?? p.schema?.default ?? p.schema?.enum?.[0] ?? "") : "";
  const first = op.request_body?.contents.find((c) => c.supported);
  return { params, contentType: first?.content_type || "", bodyText: first ? examplesToText(first.content_type, first.example) : "", headers: [] };
}

// Swagger-style "try it out": pick an endpoint from the imported spec, fill in the form (pre-filled
// from the spec's examples), and send a real request. Requests go through the API Nexus server, so
// they aren't blocked by browser cross-origin rules; the server refuses internal addresses by default.
export default function ApiExplorer({ projectId, myRole, focus }) {
  const { push } = useToast();
  const canSend = myRole === "leader" || myRole === "member";
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [focusMissing, setFocusMissing] = useState("");
  const [forms, setForms] = useState({});
  const [baseUrl, setBaseUrl] = useState(() => loadBaseUrl(projectId));
  const [creds, setCreds] = useState(() => loadCreds(projectId));
  const [authOpen, setAuthOpen] = useState(false);
  const [results, setResults] = useState({});
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");
  const [history, setHistory] = useState([]);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/openapi/operations`)
      .then((d) => {
        setData(d);
        const match = focus ? d.operations.find((o) => o.method === focus.method && o.path === focus.path) : null;
        if (focus && !match) setFocusMissing(`${focus.method} ${focus.path}`);
        setSelected(match ? opKey(match) : d.operations[0] ? opKey(d.operations[0]) : null);
        setBaseUrl((current) => current || (d.servers.find((s) => /^https?:\/\//i.test(s.url))?.url ?? ""));
      })
      .catch((err) => setLoadError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const op = useMemo(() => data?.operations.find((o) => opKey(o) === selected) || null, [data, selected]);
  const form = op ? forms[opKey(op)] || initialForm(op) : null;
  const result = op ? results[opKey(op)] : null;

  const grouped = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    const matches = data.operations.filter((o) => !q || `${o.method} ${o.path} ${o.summary} ${o.tags.join(" ")} ${o.operation_id || ""}`.toLowerCase().includes(q));
    const byTag = new Map();
    for (const o of matches) byTag.set(o.tags[0], [...(byTag.get(o.tags[0]) || []), o]);
    return [...byTag.entries()];
  }, [data, search]);

  const auth = useMemo(() => (op && data ? applyAuth(op, data.security_schemes, creds) : null), [op, data, creds]);

  // The request exactly as it would be sent, for the URL preview and for cURL.
  function assemble() {
    const pathValues = {};
    op.parameters.filter((p) => p.in === "path").forEach((p) => (pathValues[p.name] = form.params[paramKey(p)]));
    const { url, missing } = buildUrl(baseUrl, op.path, pathValues, [...queryEntriesFor(op.parameters, form.params), ...auth.query]);
    const headers = {};
    op.parameters.filter((p) => p.in === "header").forEach((p) => {
      const v = (form.params[paramKey(p)] ?? "").toString().trim();
      if (v) headers[p.name] = v;
    });
    const cookies = op.parameters.filter((p) => p.in === "cookie").map((p) => [p.name, (form.params[paramKey(p)] ?? "").toString().trim()]).filter(([, v]) => v);
    if (cookies.length) headers.Cookie = cookies.map(([k, v]) => `${k}=${v}`).join("; ");
    form.headers.filter((h) => h.name.trim()).forEach((h) => (headers[h.name.trim()] = h.value));
    Object.assign(headers, auth.headers);
    let body = null;
    let bodyError = "";
    if (op.request_body && form.contentType) {
      const b = bodyForSend(form.contentType, form.bodyText);
      if (b.error) bodyError = b.error;
      else if (b.body !== null) {
        body = b.body;
        if (!Object.keys(headers).some((k) => k.toLowerCase() === "content-type")) headers["Content-Type"] = form.contentType;
      }
    }
    if (!Object.keys(headers).some((k) => k.toLowerCase() === "accept")) headers.Accept = "application/json, */*;q=0.8";
    return { method: op.method, url, headers, body, missing, bodyError };
  }

  const preview = op && form ? assemble() : null;

  function updateForm(patch) {
    setForms((f) => ({ ...f, [opKey(op)]: { ...form, ...patch } }));
  }
  const setParam = (p, value) => updateForm({ params: { ...form.params, [paramKey(p)]: value } });
  const chooseBase = (value) => {
    setBaseUrl(value);
    saveBaseUrl(projectId, value);
  };
  const changeCreds = (next) => {
    setCreds(next);
    saveCreds(projectId, next);
  };

  async function copy(text, message) {
    try {
      await navigator.clipboard.writeText(text);
      push(message, "success");
    } catch {
      push("Couldn't copy automatically. Select the text and copy it.", "error");
    }
  }

  async function send() {
    setFormError("");
    const req = assemble();
    if (!/^https?:\/\/[^/\s]+/i.test(baseUrl.trim())) return setFormError("Enter a base URL that starts with http:// or https://, for example https://api.example.com/v1.");
    if (req.missing.length) return setFormError(`Fill in the path parameter${req.missing.length > 1 ? "s" : ""}: ${req.missing.join(", ")}.`);
    const empty = op.parameters.filter((p) => p.required && p.in !== "path" && !(form.params[paramKey(p)] ?? "").toString().trim());
    if (empty.length) return setFormError(`Required: ${empty.map((p) => p.name).join(", ")}.`);
    if (req.bodyError) return setFormError(req.bodyError);

    setSending(true);
    const key = opKey(op);
    try {
      const response = await api.post(`/projects/${projectId}/try-it`, { method: req.method, url: req.url, headers: req.headers, body: req.body });
      const entry = { response, request: req, secrets: { secretHeaders: auth.secretHeaders, secretQuery: auth.secretQuery }, at: Date.now() };
      setResults((r) => ({ ...r, [key]: entry }));
      setHistory((h) => [{ id: `${Date.now()}`, key, method: op.method, path: op.path, status: response.status, ms: response.elapsed_ms, entry }, ...h].slice(0, 10));
    } catch (err) {
      setResults((r) => ({ ...r, [key]: { error: err.message, at: Date.now() } }));
    } finally {
      setSending(false);
    }
  }

  function copyCurl() {
    const req = assemble();
    copy(buildCurl(req, { secretHeaders: auth.secretHeaders, secretQuery: auth.secretQuery }), "cURL command copied (secrets hidden)");
  }

  if (loadError) return <EmptyState title="Couldn't load the API spec">{loadError}</EmptyState>;
  if (!data) return <LoadingRow>Loading endpoints…</LoadingRow>;
  if (!data.spec)
    return (
      <EmptyState title="No API spec to call yet">
        Import an OpenAPI spec from the Graph tab (Import OpenAPI) and every endpoint in it appears here, ready to send real requests.
      </EmptyState>
    );
  if (data.operations.length === 0) return <EmptyState title="This spec has no operations">The latest import ({data.spec.title}) doesn't define any paths to call.</EmptyState>;

  const supportedContents = op?.request_body?.contents.filter((c) => c.supported) || [];
  const bodyIsJson = isJsonType(form?.contentType);
  let jsonHint = "";
  if (bodyIsJson && form.bodyText.trim()) {
    try {
      JSON.parse(form.bodyText);
    } catch (e) {
      jsonHint = `Not valid JSON yet: ${e.message}`;
    }
  }
  const maskedUrl = (() => {
    if (!preview) return "";
    try {
      const u = new URL(preview.url);
      auth.secretQuery.forEach((n) => u.searchParams.has(n) && u.searchParams.set(n, "••••"));
      return decodeURIComponent(u.toString()).replace(/%7B/g, "{").replace(/%7D/g, "}");
    } catch {
      return preview.url;
    }
  })();

  return (
    <div className="explorer">
      <aside className="explorer-list" aria-label="Endpoints">
        <div className="explorer-list-head">
          <input type="search" placeholder="Filter endpoints" aria-label="Filter endpoints" value={search} onChange={(e) => setSearch(e.target.value)} />
          <span className="text-muted text-sm">{data.spec.title} · {data.spec.version_label}</span>
        </div>
        {grouped.length === 0 && <p className="explorer-empty">No endpoint matches “{search}”.</p>}
        {grouped.map(([tag, ops]) => (
          <div key={tag} className="explorer-tag">
            <h3>{tag}</h3>
            {ops.map((o) => (
              <button
                key={opKey(o)}
                type="button"
                className={`explorer-op${opKey(o) === selected ? " is-active" : ""}${o.deprecated ? " is-deprecated" : ""}`}
                aria-current={opKey(o) === selected ? "true" : undefined}
                onClick={() => { setSelected(opKey(o)); setFormError(""); setFocusMissing(""); }}
              >
                <span className={`method-tag method-${o.method}`}>{o.method}</span>
                <span className="explorer-op-path mono">{o.path}</span>
              </button>
            ))}
          </div>
        ))}
      </aside>

      <section className="explorer-main" aria-label="Request">
        {focusMissing && <div className="notice notice-warn"><strong>{focusMissing}</strong> isn't in the latest imported spec, so there's nothing to send for it. Showing the first endpoint instead.</div>}
        {!canSend && <div className="notice">You can read the API here, but sending requests needs member or leader access.</div>}

        <header className="explorer-head">
          <h2>
            <span className={`method-tag method-${op.method}`}>{op.method}</span>
            <span className="mono">{op.path}</span>
            {op.deprecated && <span className="badge badge-amber">Deprecated</span>}
          </h2>
          {op.summary && <p className="explorer-summary">{op.summary}</p>}
          {op.description && <p className="field-hint" style={{ margin: 0 }}>{op.description}</p>}
          {op.responses.length > 0 && (
            <p className="explorer-codes">
              <span className="text-muted">Documented responses:</span>{" "}
              {op.responses.map((r) => <span key={r.status} className="badge badge-gray" title={r.description}>{r.status}</span>)}
            </p>
          )}
        </header>

        <div className="field">
          <label htmlFor="explorer-base">Base URL</label>
          <input id="explorer-base" value={baseUrl} spellCheck={false} placeholder="https://api.example.com/v1" onChange={(e) => chooseBase(e.target.value)} />
          <div className="explorer-servers">
            {data.servers.map((s) => (
              <button key={s.url} type="button" className="chip" aria-pressed={baseUrl === s.url} onClick={() => chooseBase(s.url)} title={s.description}>{s.url}</button>
            ))}
            {data.servers.length === 0 && <span className="field-hint">This spec doesn't list any servers, so enter where the API is running.</span>}
          </div>
          {data.servers.some((s) => s.url.startsWith("/")) && !/^https?:/i.test(baseUrl) && (
            <div className="field-hint">The spec's server URL is relative ({data.servers.find((s) => s.url.startsWith("/")).url}). Add the host in front of it.</div>
          )}
        </div>

        <ExplorerAuth schemes={data.security_schemes} creds={creds} onChange={changeCreds} op={op} open={authOpen} onToggle={setAuthOpen} />
        {auth.missing.length > 0 && (
          <div className="notice notice-warn">
            This endpoint needs <strong>{auth.missing.join(", ")}</strong>.{" "}
            <button type="button" className="link-btn" onClick={() => setAuthOpen(true)}>Open Authorize</button> to add it, or send anyway to see the API's response.
          </div>
        )}
        {auth.applied.length > 0 && <p className="field-hint" style={{ margin: 0 }}>Sending with {auth.applied.join(" + ")}.</p>}

        {GROUPS.map(([where, title]) => {
          const ps = op.parameters.filter((p) => p.in === where);
          if (!ps.length) return null;
          return (
            <fieldset className="explorer-group" key={where}>
              <legend>{title}</legend>
              {ps.map((p) => {
                const id = `param-${where}-${p.name}`;
                const val = form.params[paramKey(p)] ?? "";
                const options = p.schema?.enum || (p.schema?.type === "boolean" ? ["true", "false"] : null);
                return (
                  <div className="explorer-param" key={id}>
                    <label htmlFor={id}>
                      <span className="mono">{p.name}</span>
                      {p.required && <span className="req" title="Required"> *</span>}
                      <span className="text-muted explorer-type">{p.schema?.type === "array" ? `list of ${p.schema.items_type || "values"}` : p.schema?.type || ""}{p.schema?.format ? ` (${p.schema.format})` : ""}</span>
                      {p.deprecated && <span className="badge badge-amber">deprecated</span>}
                    </label>
                    {options ? (
                      <select id={id} value={val} onChange={(e) => setParam(p, e.target.value)}>
                        {!p.required && <option value="">(not set)</option>}
                        {options.map((o) => <option key={String(o)} value={String(o)}>{String(o)}</option>)}
                      </select>
                    ) : (
                      <input id={id} value={val} spellCheck={false} placeholder={String(p.example ?? p.schema?.default ?? (p.schema?.type === "array" ? "a, b, c" : p.schema?.type) ?? "")} onChange={(e) => setParam(p, e.target.value)} />
                    )}
                    {p.description && <span className="field-hint">{p.description}</span>}
                  </div>
                );
              })}
            </fieldset>
          );
        })}

        <fieldset className="explorer-group">
          <legend>Extra headers</legend>
          {form.headers.map((h, i) => (
            <div className="explorer-header-row" key={i}>
              <input aria-label="Header name" placeholder="X-Request-Id" value={h.name} onChange={(e) => updateForm({ headers: form.headers.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} />
              <input aria-label="Header value" placeholder="value" value={h.value} onChange={(e) => updateForm({ headers: form.headers.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
              <button type="button" className="btn btn-sm btn-ghost" aria-label="Remove header" onClick={() => updateForm({ headers: form.headers.filter((_, j) => j !== i) })}>Remove</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm" onClick={() => updateForm({ headers: [...form.headers, { name: "", value: "" }] })}>Add header</button>
        </fieldset>

        {op.request_body && (
          <fieldset className="explorer-group">
            <legend>Request body{op.request_body.required ? " *" : ""}</legend>
            {supportedContents.length === 0 ? (
              <p className="explorer-empty">This endpoint only accepts {op.request_body.contents.map((c) => c.content_type).join(", ")}, which the Explorer can't send yet (file uploads and binary data).</p>
            ) : (
              <>
                {supportedContents.length > 1 && (
                  <div className="field">
                    <label htmlFor="explorer-ct">Content type</label>
                    <select id="explorer-ct" value={form.contentType} onChange={(e) => { const c = supportedContents.find((x) => x.content_type === e.target.value); updateForm({ contentType: c.content_type, bodyText: examplesToText(c.content_type, c.example) }); }}>
                      {supportedContents.map((c) => <option key={c.content_type} value={c.content_type}>{c.content_type}</option>)}
                    </select>
                  </div>
                )}
                <textarea className="code explorer-textarea" aria-label="Request body" spellCheck={false} rows={Math.min(16, Math.max(5, form.bodyText.split("\n").length + 1))} value={form.bodyText} onChange={(e) => updateForm({ bodyText: e.target.value })} />
                {jsonHint && <div className="field-error">{jsonHint}</div>}
                <div className="explorer-body-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => { const c = supportedContents.find((x) => x.content_type === form.contentType); updateForm({ bodyText: examplesToText(c.content_type, c.example) }); }}>Reset to example</button>
                  {bodyIsJson && <button type="button" className="btn btn-sm btn-ghost" disabled={!!jsonHint} onClick={() => { try { updateForm({ bodyText: JSON.stringify(JSON.parse(form.bodyText), null, 2) }); } catch { /* hint already shown */ } }}>Format JSON</button>}
                </div>
              </>
            )}
          </fieldset>
        )}

        <div className="explorer-url" title="The URL that will be called">
          <span className="text-muted">Will call</span> <code>{op.method} {maskedUrl}</code>
        </div>
        {formError && <div className="field-error" role="alert">{formError}</div>}
        <div className="explorer-actions">
          <button type="button" className={`btn btn-primary${sending ? " is-loading" : ""}`} onClick={send} disabled={sending || !canSend} aria-busy={sending} title={canSend ? undefined : "Viewers can't send requests"}>
            {sending ? "Sending…" : "Send request"}
          </button>
          <button type="button" className="btn" onClick={copyCurl}>Copy as cURL</button>
        </div>

        {result && <ExplorerResponse key={result.at} result={result} op={op} onCopy={copy} />}

        {history.length > 0 && (
          <details className="explorer-history">
            <summary>Recent requests this session ({history.length})</summary>
            <ul>
              {history.map((h) => (
                <li key={h.id}>
                  <button type="button" className="link-btn" onClick={() => { setSelected(h.key); setResults((r) => ({ ...r, [h.key]: h.entry })); }}>
                    <span className={`method-tag method-${h.method}`}>{h.method}</span> <span className="mono">{h.path}</span>
                  </button>
                  <span className={`badge badge-${h.status >= 500 ? "red" : h.status >= 400 ? "amber" : "green"}`}>{h.status}</span>
                  <span className="text-muted tabular">{h.ms} ms</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </div>
  );
}
