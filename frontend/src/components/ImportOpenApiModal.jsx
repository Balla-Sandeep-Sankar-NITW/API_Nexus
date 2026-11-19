import { useState } from "react";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

// Two steps: preview (POST /openapi/preview, writes nothing) then import
// (POST /openapi/import-raw). Both accept JSON or YAML, detected on the server.
export default function ImportOpenApiModal({ projectId, hasImportedSpec, onClose, onImported }) {
  const [raw, setRaw] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const { push } = useToast();

  function changeRaw(text) {
    setRaw(text);
    setPreview(null); // the preview described the old text
    setError("");
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => changeRaw(String(reader.result));
    reader.readAsText(file);
  }

  const body = () => ({ raw_text: raw, format: "auto", version_label: versionLabel });

  async function handlePreview() {
    setError("");
    setBusy(true);
    try {
      setPreview(await api.post(`/projects/${projectId}/openapi/preview`, body()));
    } catch (err) {
      setPreview(null);
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleImport() {
    setError("");
    setBusy(true);
    try {
      const summary = await api.post(`/projects/${projectId}/openapi/import-raw`, body());
      push(
        `Imported ${summary.title}: ${summary.nodes_created} nodes, ${summary.edges_created} edges from ${summary.endpoints_found} endpoints`,
        "success"
      );
      onImported();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Import OpenAPI specification"
      onClose={onClose}
      width="580px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          {preview ? (
            <button type="button" className={`btn btn-primary${busy ? " is-loading" : ""}`} onClick={handleImport} disabled={busy} aria-busy={busy}>
              {busy ? "Importing…" : "Import and generate graph"}
            </button>
          ) : (
            <button type="button" className={`btn btn-primary${busy ? " is-loading" : ""}`} onClick={handlePreview} disabled={busy || !raw.trim()} aria-busy={busy}>
              {busy ? "Checking…" : "Preview import"}
            </button>
          )}
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      {hasImportedSpec && (
        <div className="notice notice-warn">
          <strong>This project already has an imported spec.</strong> Importing again adds a second set of nodes and links
          alongside the existing ones; it doesn't update or replace them.
        </div>
      )}
      <div className="field">
        <label htmlFor="version-label">Version label</label>
        <input id="version-label" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1, v2, 2026-09" />
      </div>
      <div className="field">
        <label htmlFor="spec-file">Upload a .json, .yaml or .yml file</label>
        <input id="spec-file" type="file" accept=".json,.yaml,.yml,application/json,text/yaml" onChange={handleFile} />
      </div>
      <div className="field">
        <label htmlFor="spec-paste">Or paste the OpenAPI JSON or YAML</label>
        <textarea
          id="spec-paste"
          value={raw}
          onChange={(e) => changeRaw(e.target.value)}
          placeholder={'openapi: 3.0.0\ninfo: {...}\npaths: {...}'}
          className="code"
          spellCheck={false}
        />
        <div className="field-hint">Nodes and edges are generated from paths, schemas, and security schemes.</div>
      </div>

      {preview && (
        <div className="import-preview" aria-live="polite">
          <h3>{preview.title}</h3>
          <dl className="stat-row stat-row-tight">
            <div><dt>Endpoints</dt><dd>{preview.endpoints_found}</dd></div>
            <div><dt>Schemas</dt><dd>{preview.schemas_found}</dd></div>
            <div><dt>Security schemes</dt><dd>{preview.security_schemes_found}</dd></div>
          </dl>
          {preview.warnings.map((w) => (
            <div key={w} className="notice notice-warn">{w}</div>
          ))}
          <PreviewList title="Endpoints" items={preview.endpoint_list} />
          <PreviewList title="Schemas" items={preview.schema_list} />
          <PreviewList title="Security schemes" items={preview.security_scheme_list} />
        </div>
      )}
    </Modal>
  );
}

function PreviewList({ title, items }) {
  if (!items || items.length === 0) return null;
  return (
    <details className="preview-list">
      <summary>{title} ({items.length})</summary>
      <ul>
        {items.map((i) => (
          <li key={i} className="mono">{i}</li>
        ))}
      </ul>
    </details>
  );
}
