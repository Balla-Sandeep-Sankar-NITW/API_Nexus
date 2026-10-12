import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";
import ConfirmDialog from "./ConfirmDialog";

const DIFF_GROUPS = [
  ["endpoints_added", "Endpoints added", "added"],
  ["endpoints_removed", "Endpoints removed", "removed"],
  ["schemas_added", "Schemas added", "added"],
  ["schemas_removed", "Schemas removed", "removed"],
  ["security_schemes_added", "Security schemes added", "added"],
  ["security_schemes_removed", "Security schemes removed", "removed"],
];

function SpecVersions({ projectId }) {
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

// Versions tab = OpenAPI import history (above) + graph snapshots (below).
// Snapshots are the backend's /snapshots endpoints: save the current graph,
// compare a saved one against the live graph, or restore it (leader only).
export default function VersionsPanel({ projectId, myRole, onGraphChanged }) {
  return (
    <>
      <SpecVersions projectId={projectId} />
      <SnapshotsSection projectId={projectId} myRole={myRole} onGraphChanged={onGraphChanged} />
    </>
  );
}

function SnapshotsSection({ projectId, myRole, onGraphChanged }) {
  const [snapshots, setSnapshots] = useState(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [diffFor, setDiffFor] = useState(null); // { snapshot, diff }
  const [restoreTarget, setRestoreTarget] = useState(null);
  const { push } = useToast();

  const canSave = myRole === "leader" || myRole === "member";
  const canRestore = myRole === "leader";

  function load() {
    api.get(`/projects/${projectId}/snapshots`).then(setSnapshots).catch((err) => {
      setSnapshots([]);
      push(err.message, "error");
    });
  }
  useEffect(load, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setSaving(true);
    try {
      await api.post(`/projects/${projectId}/snapshots`, { label: label.trim() });
      push(`Snapshot "${label.trim()}" saved`, "success");
      setLabel("");
      load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleCompare(snapshot) {
    try {
      const diff = await api.get(`/projects/${projectId}/snapshots/${snapshot.id}/diff`);
      setDiffFor({ snapshot, diff });
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleRestore() {
    const target = restoreTarget;
    setRestoreTarget(null);
    try {
      const result = await api.post(`/projects/${projectId}/snapshots/${target.id}/restore`);
      push(`Restored "${target.label}": ${result.nodes} nodes, ${result.edges} links`, "success");
      setDiffFor(null);
      onGraphChanged?.();
      load();
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <section className="section" aria-labelledby="snapshots-heading">
      <div className="section-head">
        <h2 id="snapshots-heading">Graph snapshots</h2>
        <p>Save the graph as it is now, so you can see what changed later or roll back.</p>
      </div>

      {canSave && (
        <form className="inline-form" onSubmit={handleSave}>
          <div className="field">
            <label htmlFor="snapshot-label">Snapshot name</label>
            <input id="snapshot-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Before payments refactor" maxLength={200} />
          </div>
          <button type="submit" className={`btn btn-primary${saving ? " is-loading" : ""}`} disabled={saving || !label.trim()}>
            {saving ? "Saving…" : "Save snapshot"}
          </button>
        </form>
      )}

      {snapshots === null && <LoadingRow>Loading snapshots…</LoadingRow>}
      {snapshots && snapshots.length === 0 && (
        <EmptyState title="No snapshots yet">
          {canSave ? "Name a snapshot above to save the current graph." : "Members and leaders can save snapshots."}
        </EmptyState>
      )}

      {snapshots && snapshots.length > 0 && (
        <div className="table-wrap stack">
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col" className="num">Nodes</th>
                <th scope="col" className="num">Links</th>
                <th scope="col" className="hide-narrow">Saved</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td className="primary">{s.label}</td>
                  <td className="num" data-label="Nodes">{s.node_count}</td>
                  <td className="num" data-label="Links">{s.edge_count}</td>
                  <td className="text-muted tabular hide-narrow" data-label="Saved">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="actions">
                    <button type="button" className="btn btn-sm btn-ghost" onClick={() => handleCompare(s)}>Compare to now</button>
                    {canRestore && (
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRestoreTarget(s)}>Restore</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {diffFor && (
        <div className="diff" aria-live="polite">
          <div className="diff-group">
            <h3>Current graph compared with "{diffFor.snapshot.label}"</h3>
            <p className="field-hint" style={{ margin: 0 }}>
              {diffFor.diff.edges_added > 0 && `${diffFor.diff.edges_added} more link${diffFor.diff.edges_added === 1 ? "" : "s"} now. `}
              {diffFor.diff.edges_removed > 0 && `${diffFor.diff.edges_removed} fewer link${diffFor.diff.edges_removed === 1 ? "" : "s"} now. `}
              {diffFor.diff.edges_added === 0 && diffFor.diff.edges_removed === 0 && "Same number of links. "}
              {diffFor.diff.nodes_added.length === 0 && diffFor.diff.nodes_removed.length === 0 && "No nodes added or removed."}
            </p>
          </div>
          {diffFor.diff.nodes_added.length > 0 && (
            <div className="diff-group">
              <h3>Nodes added since ({diffFor.diff.nodes_added.length})</h3>
              <ul className="diff-list diff-added">
                {diffFor.diff.nodes_added.map((n) => (
                  <li key={n}><span className="diff-sign" aria-hidden="true">+</span><span>{n}</span></li>
                ))}
              </ul>
            </div>
          )}
          {diffFor.diff.nodes_removed.length > 0 && (
            <div className="diff-group">
              <h3>Nodes removed since ({diffFor.diff.nodes_removed.length})</h3>
              <ul className="diff-list diff-removed">
                {diffFor.diff.nodes_removed.map((n) => (
                  <li key={n}><span className="diff-sign" aria-hidden="true">−</span><span>{n}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {restoreTarget && (
        <ConfirmDialog
          title="Restore snapshot"
          message={`Replace the current graph with "${restoreTarget.label}"? Restoring creates new nodes, so comments, freeze status and freeze plans on the current nodes won't carry over. Consider saving a snapshot of the current graph first.`}
          confirmLabel="Restore snapshot"
          danger
          onConfirm={handleRestore}
          onCancel={() => setRestoreTarget(null)}
        />
      )}
    </section>
  );
}
