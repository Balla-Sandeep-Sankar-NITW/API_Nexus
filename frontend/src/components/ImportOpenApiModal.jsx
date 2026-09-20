import { useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function ImportOpenApiModal({ projectId, onClose, onImported }) {
  const [raw, setRaw] = useState("");
  const [format, setFormat] = useState("auto");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [error, setError] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const { push } = useToast();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.name.endsWith(".yaml") || file.name.endsWith(".yml")) setFormat("yaml");
    else if (file.name.endsWith(".json")) setFormat("json");
    const reader = new FileReader();
    reader.onload = () => {
      setRaw(reader.result);
      setPreview(null);
    };
    reader.readAsText(file);
  }

  async function handlePreview() {
    setError("");
    setPreviewing(true);
    try {
      const result = await api.post(`/projects/${projectId}/openapi/preview`, {
        raw_text: raw,
        format,
        version_label: versionLabel,
      });
      setPreview(result);
    } catch (err) {
      setError(err.message);
      setPreview(null);
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    setError("");
    setImporting(true);
    try {
      const summary = await api.post(`/projects/${projectId}/openapi/import-raw`, {
        raw_text: raw,
        format,
        version_label: versionLabel,
      });
      push(
        `Imported ${summary.title}: ${summary.nodes_created} nodes, ${summary.edges_created} edges from ${summary.endpoints_found} endpoints`,
        "success"
      );
      onImported();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <Modal
      title="Import OpenAPI specification"
      onClose={onClose}
      width="600px"
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={handlePreview} disabled={previewing || !raw.trim()}>
            {previewing ? "Checking…" : "Preview"}
          </button>
          <button className="btn btn-primary" onClick={handleImport} disabled={importing || !raw.trim()}>
            {importing ? "Importing…" : "Import and generate graph"}
          </button>
        </>
      }
    >
      {error && <div className="auth-error">{error}</div>}
      <div style={{ display: "flex", gap: 10 }}>
        <div className="field" style={{ flex: 1 }}>
          <label htmlFor="version-label">Version label</label>
          <input id="version-label" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1, v2, 2026-09…" />
        </div>
        <div className="field" style={{ width: 120 }}>
          <label htmlFor="format">Format</label>
          <select id="format" value={format} onChange={(e) => setFormat(e.target.value)}>
            <option value="auto">Auto-detect</option>
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label htmlFor="spec-file">Upload a .json or .yaml file</label>
        <input id="spec-file" type="file" accept=".json,.yaml,.yml,application/json,text/yaml" onChange={handleFile} />
      </div>
      <div className="field">
        <label htmlFor="spec-paste">Or paste the OpenAPI spec (JSON or YAML)</label>
        <textarea
          id="spec-paste"
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setPreview(null);
          }}
          placeholder='{"openapi": "3.0.0", "info": {...}, "paths": {...}}'
          style={{ minHeight: 160, fontFamily: "var(--font-mono)", fontSize: 12 }}
        />
        <div className="field-hint">Nodes and edges are generated automatically from paths, schemas, and security schemes.</div>
      </div>

      {preview && (
        <div className="panel" style={{ marginTop: 4 }}>
          <div className="panel-header"><h2 style={{ margin: 0 }}>{preview.title}</h2></div>
          <div className="panel-body">
            {preview.warnings.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                {preview.warnings.map((w, i) => (
                  <div key={i} className="badge badge-amber" style={{ marginBottom: 4 }}><span className="badge-dot" />{w}</div>
                ))}
              </div>
            )}
            <div className="detail-row"><span className="k">Endpoints</span><span className="v">{preview.endpoints_found}</span></div>
            <div className="detail-row"><span className="k">Schemas</span><span className="v">{preview.schemas_found}</span></div>
            <div className="detail-row"><span className="k">Security schemes</span><span className="v">{preview.security_scheme_list.join(", ") || "none"}</span></div>
            {preview.endpoint_list.length > 0 && (
              <div style={{ marginTop: 8, fontSize: 12, color: "var(--ink-500)", maxHeight: 100, overflowY: "auto" }}>
                {preview.endpoint_list.join(" · ")}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
