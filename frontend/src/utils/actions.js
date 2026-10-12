// Audit-log action codes -> short readable labels. Unknown codes fall back to a
// tidied version of the code, so a new backend action never shows up blank.
const LABELS = {
  "project.create": "Created project",
  "project.update": "Edited project details",
  "project.archive_toggle": "Archived or restored project",
  "project.share_enabled": "Turned on share link",
  "project.share_disabled": "Turned off share link",
  "member.invite": "Added a member",
  "member.remove": "Removed a member",
  "member.role_change": "Changed a member's role",
  "spec.import": "Imported an OpenAPI spec",
  "node.create": "Added a node",
  "node.update": "Edited a node",
  "node.delete": "Deleted a node",
  "node.deprecate": "Deprecated a node",
  "node.freeze": "Froze a node (temporary)",
  "node.freeze_permanent": "Froze a node (project freeze)",
  "node.unfreeze": "Unfroze a node",
  "edge.create": "Added a link",
  "edge.update": "Edited a link",
  "edge.delete": "Removed a link",
  "comment.add": "Commented",
  "suggestion.review": "Reviewed a suggestion",
  "freeze_plan.create": "Created a freeze plan",
  "freeze_plan.step_update": "Updated a freeze-plan step",
  "snapshot.create": "Saved a snapshot",
  "snapshot.restore": "Restored a snapshot",
};

export function describeAction(code) {
  if (LABELS[code]) return LABELS[code];
  const text = String(code || "").replace(/[._]/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
