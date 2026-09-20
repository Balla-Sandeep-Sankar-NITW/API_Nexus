import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

export default function FindingsPanel({ projectId }) {
  const [data, setData] = useState(null);
  const { push } = useToast();

  useEffect(() => {
    api.get(`/projects/${projectId}/findings`).then(setData).catch((err) => push(err.message, "error"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  if (data === null) {
    return <div className="loading-row"><span className="spinner" />Analyzing graph…</div>;
  }

  if (data.findings.length === 0) {
    return (
      <div className="empty-state panel">
        <h3>No findings</h3>
        <p>Nothing structurally risky detected in the current graph shape.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="toolbar">
        <span className="badge badge-red"><span className="badge-dot" />{data.high_count} high</span>
        <span className="badge badge-amber"><span className="badge-dot" />{data.medium_count} medium</span>
        <span className="badge badge-gray"><span className="badge-dot" />{data.low_count} low</span>
      </div>
      <div className="panel">
        {data.findings.map((f, i) => (
          <div key={f.id} className="detail-section" style={{ borderBottom: i === data.findings.length - 1 ? "none" : undefined }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>{f.title}</div>
              <span className={`badge badge-${f.severity === "high" ? "red" : f.severity === "medium" ? "amber" : "gray"}`}>
                <span className="badge-dot" />{f.severity}
              </span>
            </div>
            <p style={{ fontSize: 12.5, color: "var(--ink-700)", margin: "0 0 8px" }}>{f.description}</p>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>
              <strong style={{ color: "var(--ink-700)" }}>Suggested action: </strong>
              {f.remediation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
