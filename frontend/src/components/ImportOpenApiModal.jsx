import { useState } from "react";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function ImportOpenApiModal({ projectId, onClose, onImported }) {
  const [raw, setRaw] = useState("");
  const [versionLabel, setVersionLabel] = useState("v1");
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);
  const { push } = useToast();

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setRaw(reader.result);
    reader.readAsText(file);
  }

  async function handleImport() {
    setError("");
    let spec;
    try {
      spec = JSON.parse(raw);
    } catch {
      setError("This isn't valid JSON. Check for a trailing comma or missing bracket.");
      return;
    }
    setImporting(true);
    try {
      const summary = await api.post(`/projects/${projectId}/openapi/import`, { spec, version_label: versionLabel });
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
      width="560px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className={`btn btn-primary${importing ? " is-loading" : ""}`} onClick={handleImport} disabled={importing || !raw.trim()} aria-busy={importing}>
            {importing ? "Importing…" : "Import and generate graph"}
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <div className="field">
        <label htmlFor="version-label">Version label</label>
        <input id="version-label" value={versionLabel} onChange={(e) => setVersionLabel(e.target.value)} placeholder="v1, v2, 2026-09" />
      </div>
      <div className="field">
        <label htmlFor="spec-file">Upload a .json file</label>
        <input id="spec-file" type="file" accept="application/json" onChange={handleFile} />
      </div>
      <div className="field">
        <label htmlFor="spec-paste">Or paste the OpenAPI JSON</label>
        <textarea
          id="spec-paste"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='{"openapi": "3.0.0", "info": {...}, "paths": {...}}'
          className="code"
          spellCheck={false}
        />
        <div className="field-hint">Nodes and edges are generated from paths, schemas, and security schemes.</div>
      </div>
    </Modal>
  );
}
