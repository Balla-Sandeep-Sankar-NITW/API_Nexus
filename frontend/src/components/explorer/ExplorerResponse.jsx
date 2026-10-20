import { useMemo, useState } from "react";
import { formatBytes, isJsonType, prettyBody, statusDocumented, statusTone, tokenizeJson } from "../../utils/explorer";

const HIGHLIGHT_LIMIT = 200_000; // beyond this, show plain text so the page stays responsive

// What came back: status, timing and size at a glance, then the body (colour-coded when it's
// JSON) or the headers. Network-level failures (blocked address, timeout, refused connection)
// arrive as `error` and are explained in plain words.
export default function ExplorerResponse({ result, op, onCopy }) {
  const [view, setView] = useState("body");
  const [raw, setRaw] = useState(false);
  const res = result?.response;

  const text = useMemo(() => {
    if (!res || res.body == null) return "";
    return raw ? res.body : prettyBody(res.body, res.content_type);
  }, [res, raw]);
  const tokens = useMemo(() => (res && isJsonType(res.content_type) && !raw && text.length < HIGHLIGHT_LIMIT ? tokenizeJson(text) : null), [res, raw, text]);

  if (!result) return null;

  if (result.error) {
    return (
      <div className="explorer-error" role="alert">
        <strong>The request didn't go through</strong>
        <p>{result.error}</p>
        {/blocked on this server|can't be called from this server/i.test(result.error) && (
          <p className="field-hint">
            To call APIs on a private network or localhost, whoever runs API Nexus can set <code>TRYIT_ALLOW_PRIVATE_NETWORKS=true</code> on the server.
          </p>
        )}
      </div>
    );
  }

  const tone = statusTone(res.status);
  const documented = op ? statusDocumented(op, res.status) : null;
  const headers = res.headers || [];

  return (
    <div className="explorer-response" aria-live="polite">
      <div className="explorer-status">
        <span className={`badge badge-${tone}`}>
          <span className="badge-dot" aria-hidden="true" />
          {res.status} {res.reason}
        </span>
        <span className="text-muted tabular">{res.elapsed_ms} ms</span>
        <span className="text-muted tabular">{formatBytes(res.size_bytes)}</span>
        {res.content_type && <span className="text-muted mono truncate">{res.content_type.split(";")[0]}</span>}
        {documented !== null && (
          <span className={`badge ${documented ? "badge-gray" : "badge-amber"}`} title="Whether this status code is listed under the operation's responses in the spec">
            {documented ? "documented in spec" : "not in spec"}
          </span>
        )}
      </div>

      {res.status >= 300 && res.status < 400 && (
        <p className="field-hint" style={{ margin: "0 0 var(--sp-2)" }}>Redirects aren't followed. Check the Location header to see where it points.</p>
      )}

      <div className="explorer-tabs" role="tablist" aria-label="Response">
        <button type="button" role="tab" aria-selected={view === "body"} className={view === "body" ? "is-active" : ""} onClick={() => setView("body")}>Body</button>
        <button type="button" role="tab" aria-selected={view === "headers"} className={view === "headers" ? "is-active" : ""} onClick={() => setView("headers")}>
          Headers <span className="fold-count">{headers.length}</span>
        </button>
        <span className="toolbar-spacer" />
        {view === "body" && res.body && (
          <>
            {isJsonType(res.content_type) && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRaw((r) => !r)}>{raw ? "Pretty" : "Raw"}</button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => onCopy(text, "Response copied")}>Copy</button>
          </>
        )}
      </div>

      {view === "body" &&
        (res.binary ? (
          <p className="explorer-empty">This is a binary response ({res.content_type || "unknown type"}, {formatBytes(res.size_bytes)}), so it isn't shown here.</p>
        ) : !res.body ? (
          <p className="explorer-empty">The response has no body.</p>
        ) : (
          <>
            <pre className="explorer-body" tabIndex={0}>
              {tokens ? tokens.map((t, i) => (t.kind === "plain" ? t.text : <span key={i} className={`tok-${t.kind}`}>{t.text}</span>)) : text}
            </pre>
            {res.truncated && <p className="field-hint">The response was longer than the server's limit, so it was cut off after {formatBytes(res.size_bytes)}.</p>}
          </>
        ))}

      {view === "headers" && (
        <div className="table-wrap">
          <table className="table">
            <tbody>
              {headers.map(([k, v], i) => (
                <tr key={i}>
                  <td className="primary mono" style={{ whiteSpace: "nowrap" }}>{k}</td>
                  <td className="mono" style={{ wordBreak: "break-all" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
