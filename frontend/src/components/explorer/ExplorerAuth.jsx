// "Authorize": credentials for the security schemes the spec defines. They live only in this
// browser tab (sessionStorage), are cleared when you log out, and are sent only with the
// request you click Send on.
export default function ExplorerAuth({ schemes, creds, onChange, op, open, onToggle }) {
  if (schemes.length === 0) {
    return (
      <p className="field-hint" style={{ margin: 0 }}>
        This spec doesn't define any security schemes. If the API needs a key or token, add it as a custom header below.
      </p>
    );
  }

  const usedBy = new Set((op.security || []).flat());
  const isSet = (s) => {
    const c = creds[s.name];
    return c && (s.kind === "basic" ? c.username || c.password : (c.value || "").trim());
  };
  const setCount = schemes.filter(isSet).length;
  const update = (name, patch) => onChange({ ...creds, [name]: { ...(creds[name] || {}), ...patch } });
  const clear = (name) => {
    const next = { ...creds };
    delete next[name];
    onChange(next);
  };

  return (
    <details className="explorer-auth" open={open} onToggle={(e) => onToggle(e.currentTarget.open)}>
      <summary>
        <span>Authorize</span>
        <span className={`badge ${setCount ? "badge-green" : "badge-gray"}`}>{setCount ? `${setCount} set` : "none set"}</span>
      </summary>
      <div className="explorer-auth-body">
        <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
          Kept in this browser tab only and cleared when you log out. They're passed through API Nexus to the API for the request you send, and never stored.
        </p>
        {schemes.map((s) => (
          <div className="explorer-scheme" key={s.name}>
            <div className="explorer-scheme-head">
              <strong>{s.name}</strong>
              <span className="text-muted">
                {s.kind === "bearer" ? (s.type === "http" ? `Bearer token${s.bearer_format ? ` (${s.bearer_format})` : ""}` : "Access token") : s.kind === "basic" ? "Username and password" : `API key in ${s.in || "header"}: ${s.param_name}`}
              </span>
              {usedBy.has(s.name) && <span className="badge badge-teal">this endpoint</span>}
            </div>
            {s.description && <p className="field-hint" style={{ margin: "0 0 var(--sp-2)" }}>{s.description}</p>}
            {s.kind === "basic" ? (
              <div className="field-row">
                <div className="field">
                  <label htmlFor={`auth-${s.name}-u`}>Username</label>
                  <input id={`auth-${s.name}-u`} autoComplete="off" value={creds[s.name]?.username || ""} onChange={(e) => update(s.name, { username: e.target.value })} />
                </div>
                <div className="field">
                  <label htmlFor={`auth-${s.name}-p`}>Password</label>
                  <input id={`auth-${s.name}-p`} type="password" autoComplete="off" value={creds[s.name]?.password || ""} onChange={(e) => update(s.name, { password: e.target.value })} />
                </div>
              </div>
            ) : (
              <div className="field">
                <label htmlFor={`auth-${s.name}`}>{s.kind === "bearer" ? "Token" : "Value"}</label>
                <input
                  id={`auth-${s.name}`}
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={s.kind === "bearer" ? "Paste the token (without the word Bearer)" : "Paste the key"}
                  value={creds[s.name]?.value || ""}
                  onChange={(e) => update(s.name, { value: e.target.value })}
                />
              </div>
            )}
            {isSet(s) && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => clear(s.name)}>
                Clear {s.name}
              </button>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}
