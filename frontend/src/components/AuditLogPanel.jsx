import ActivityFeed from "./ActivityFeed";

export default function AuditLogPanel({ projectId }) {
  return <ActivityFeed path={`/projects/${projectId}/audit-log`} pageSize={50} />;
}
