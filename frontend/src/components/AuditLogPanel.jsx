import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

export default function AuditLogPanel({ projectId }) {
  const [logs, setLogs] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/audit-log`).then(setLogs).catch(() => setLogs([]));
  }, [projectId]);

  if (logs === null) {
    return <LoadingRow>Loading activity…</LoadingRow>;
  }

  if (logs.length === 0) {
    return (
      <EmptyState title="No activity yet">
        Actions like imports, node changes, and freezes will show up here.
      </EmptyState>
    );
  }

  return (
    <div className="table-wrap stack">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Target</th>
            <th scope="col">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td className="primary mono">{log.action}</td>
              <td className="text-muted" data-label="Target">{log.target}</td>
              <td className="text-muted tabular" data-label="Time" style={{ whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
