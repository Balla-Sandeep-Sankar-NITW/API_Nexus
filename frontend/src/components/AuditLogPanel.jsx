import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function AuditLogPanel({ projectId }) {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/audit-log`).then(setLogs).catch(() => setLogs([]));
  }, [projectId]);

  if (logs === null) {
    return <div className="loading-row"><span className="spinner" />Loading activity…</div>;
  }

  if (logs.length === 0) {
    return (
      <div className="empty-state panel">
        <h3>No activity yet</h3>
        <p>Actions like imports, node changes, and freezes will show up here.</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-body">
        {logs.map((log) => (
          <div key={log.id} className="audit-row">
            <div>
              <span className="audit-action">{log.action}</span>
              {log.target && <span style={{ color: "var(--ink-500)" }}> — {log.target}</span>}
            </div>
            <span style={{ color: "var(--ink-300)", flexShrink: 0 }}>{new Date(log.created_at).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
