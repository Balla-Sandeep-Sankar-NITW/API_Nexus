import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function VersionsPanel({ projectId }) {
  const [versions, setVersions] = useState(null);
  const [compareA, setCompareA] = useState("");
  const [compareB, setCompareB] = useState("");
  const [diff, setDiff] = useState(null);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const { push } = useToast();

  useEffect(() => {
    api
      .get(`/projects/${projectId}/openapi/versions`)
      .then((v) => {
        setVersions(v);
        if (v.length >= 2) {
          setCompareA(v[0].id);
          setCompareB(v[1].id);
        }
      })
      .catch((err) => push(err.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  async function runDiff() {
    if (!compareA || !compareB || compareA === compareB) {
      push("Pick two different versions to compare", "error");
      return;
    }
    setLoadingDiff(true);
    try {
      const result = await api.get(
        `/projects/${projectId}/openapi/versions/${compareA}/diff?compare_to=${compareB}`
      );
      setDiff(result);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoadingDiff(false);
    }
  }

  if (versions === null) {
    return <div className="loading-row"><span className="spinner" />Loading versions…</div>;
  }

  if (versions.length === 0) {
    return (
      <div className="empty-state panel">
        <h3>No OpenAPI imports yet</h3>
        <p>Once a spec is imported, every version is kept here so you can compare changes over time.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: 16 }}>
        <div className="panel-header"><h2 style={{ margin: 0 }}>Import history</h2></div>
        <table className="table">
          <thead>
            <tr><th>Version</th><th>Title</th><th>Imported</th></tr>
          </thead>
          <tbody>
            {versions.map((v) => (
              <tr key={v.id}>
                <td className="mono">{v.version_label}</td>
                <td>{v.title}</td>
                <td>{new Date(v.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {versions.length >= 2 && (
        <div className="panel">
          <div className="panel-header"><h2 style={{ margin: 0 }}>Compare versions</h2></div>
          <div className="panel-body">
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14 }}>
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label>Newer</label>
                <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version_label} — {new Date(v.created_at).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
              <div className="field" style={{ marginBottom: 0, flex: 1 }}>
                <label>Older</label>
                <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                  {versions.map((v) => (
                    <option key={v.id} value={v.id}>{v.version_label} — {new Date(v.created_at).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary btn-sm" onClick={runDiff} disabled={loadingDiff}>
                {loadingDiff ? "Comparing…" : "Compare"}
              </button>
            </div>

            {diff && (
              <div>
                <DiffGroup label="Endpoints added" items={diff.endpoints_added} color="green" />
                <DiffGroup label="Endpoints removed" items={diff.endpoints_removed} color="red" />
                <DiffGroup label="Schemas added" items={diff.schemas_added} color="green" />
                <DiffGroup label="Schemas removed" items={diff.schemas_removed} color="red" />
                <DiffGroup label="Security schemes added" items={diff.security_schemes_added} color="green" />
                <DiffGroup label="Security schemes removed" items={diff.security_schemes_removed} color="red" />
                {diff.endpoints_added.length === 0 &&
                  diff.endpoints_removed.length === 0 &&
                  diff.schemas_added.length === 0 &&
                  diff.schemas_removed.length === 0 &&
                  diff.security_schemes_added.length === 0 &&
                  diff.security_schemes_removed.length === 0 && (
                    <p style={{ fontSize: 13, color: "var(--ink-500)" }}>No structural differences between these versions.</p>
                  )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DiffGroup({ label, items, color }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ marginBottom: 12 }}>
      <div className="detail-label">{label}</div>
      {items.map((item) => (
        <span key={item} className={`badge badge-${color}`} style={{ marginRight: 6, marginBottom: 6 }}>
          <span className="badge-dot" />
          {item}
        </span>
      ))}
    </div>
  );
}
