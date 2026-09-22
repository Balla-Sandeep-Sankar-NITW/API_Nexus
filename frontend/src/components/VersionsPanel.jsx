import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

const DIFF_GROUPS = [
  ["endpoints_added", "Endpoints added", "added"],
  ["endpoints_removed", "Endpoints removed", "removed"],
  ["schemas_added", "Schemas added", "added"],
  ["schemas_removed", "Schemas removed", "removed"],
  ["security_schemes_added", "Security schemes added", "added"],
  ["security_schemes_removed", "Security schemes removed", "removed"],
];

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
    return <LoadingRow>Loading versions…</LoadingRow>;
  }

  if (versions.length === 0) {
    return (
      <EmptyState title="No OpenAPI imports yet">
        Once a spec is imported, every version is kept here so you can compare changes over time.
      </EmptyState>
    );
  }

  const groups = diff ? DIFF_GROUPS.filter(([key]) => diff[key] && diff[key].length > 0) : [];

  return (
    <>
      <section className="section">
        <div className="section-head"><h2>Import history</h2></div>
        <div className="table-wrap stack">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Version</th>
                <th scope="col">Title</th>
                <th scope="col">Imported</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td className="primary mono">{v.version_label}</td>
                  <td data-label="Title">{v.title}</td>
                  <td className="text-muted tabular" data-label="Imported">{new Date(v.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {versions.length >= 2 && (
        <section className="section">
          <div className="section-head"><h2>Compare versions</h2></div>
          <div className="compare-controls">
            <div className="field">
              <label htmlFor="compare-newer">Newer</label>
              <select id="compare-newer" value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{v.version_label} ({new Date(v.created_at).toLocaleDateString()})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="compare-older">Older</label>
              <select id="compare-older" value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>{v.version_label} ({new Date(v.created_at).toLocaleDateString()})</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className={`btn btn-primary${loadingDiff ? " is-loading" : ""}`}
              onClick={runDiff}
              disabled={loadingDiff}
            >
              {loadingDiff ? "Comparing…" : "Compare"}
            </button>
          </div>

          {diff && (
            <div className="diff" aria-live="polite">
              {groups.map(([key, label, kind]) => (
                <div className="diff-group" key={key}>
                  <h3>{label} ({diff[key].length})</h3>
                  <ul className={`diff-list diff-${kind}`}>
                    {diff[key].map((item) => (
                      <li key={item}>
                        <span className="diff-sign" aria-hidden="true">{kind === "added" ? "+" : "−"}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {groups.length === 0 && (
                <div className="diff-group text-sm text-muted">No structural differences between these versions.</div>
              )}
            </div>
          )}
        </section>
      )}
    </>
  );
}
