import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusBadge from "./StatusBadge";
import SimulateModal from "./SimulateModal";
import FreezePlanModal from "./FreezePlanModal";

const DIRECTIONS = [
  { value: "dependents", label: "Who depends on this" },
  { value: "dependencies", label: "What this depends on" },
];

const DEPTH_OPTIONS = [
  { value: "1", label: "Direct only" },
  { value: "2", label: "2 levels" },
  { value: "3", label: "3 levels" },
  { value: "all", label: "All levels" },
];

const CHANGE_IMPACT_MODES = [
  { value: "", label: "Any dependency" },
  { value: "uses_schema", label: "Schema change" },
  { value: "uses_auth", label: "Auth change" },
  { value: "depends_on,calls", label: "Service change" },
];

export default function NodeDetailPanel({
  project,
  node,
  members,
  myRole,
  onFocusChain,
  onHighlight,
  onNodeMutated,
  onDeleteNode,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isSuggestion, setIsSuggestion] = useState(false);
  const [direction, setDirection] = useState("dependents");
  const [depth, setDepth] = useState("all");
  const [changeMode, setChangeMode] = useState("");
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [focusRadius, setFocusRadius] = useState("1");
  const [focusLoading, setFocusLoading] = useState(false);
  const [showConfirmFreeze, setShowConfirmFreeze] = useState(false);
  const [showSimulate, setShowSimulate] = useState(false);
  const [showFreezePlan, setShowFreezePlan] = useState(false);
  const { push } = useToast();

  const canEdit = myRole === "leader" || myRole === "member";
  const canDelete = myRole === "leader";
  const canPermanentFreeze = myRole === "leader";
  const isLeader = myRole === "leader";

  useEffect(() => {
    setImpact(null);
    onHighlight(new Set());
    if (!node) return;
    api
      .get(`/projects/${project.id}/nodes/${node.id}/comments`)
      .then(setComments)
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  if (!node) {
    return <div className="detail-empty">Select a node to view its details, run impact analysis, or freeze it.</div>;
  }

  async function runFocus() {
    setFocusLoading(true);
    try {
      const d = Number(focusRadius);
      const [deps, dependents] = await Promise.all([
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependencies", depth: d }),
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependents", depth: d }),
      ]);
      const ids = new Set([node.id, ...deps.affected.map((a) => a.node_id), ...dependents.affected.map((a) => a.node_id)]);
      onHighlight(ids);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setFocusLoading(false);
    }
  }

  function edgeTypesForMode() {
    if (!changeMode) return null;
    return changeMode.split(",");
  }

  async function runPreview() {
    setImpactLoading(true);
    try {
      const result = await api.post(`/projects/${project.id}/impact/preview`, {
        node_id: node.id,
        direction,
        depth: depth === "all" ? null : Number(depth),
        edge_types: edgeTypesForMode(),
      });
      setImpact(result);
      onHighlight(new Set([node.id, ...result.affected.map((a) => a.node_id)]));
    } catch (err) {
      push(err.message, "error");
    } finally {
      setImpactLoading(false);
    }
  }

  async function applyFreeze(permanent) {
    setImpactLoading(true);
    try {
      const result = await api.post(`/projects/${project.id}/freeze/apply`, {
        node_id: node.id,
        direction,
        depth: depth === "all" ? null : Number(depth),
        edge_types: edgeTypesForMode(),
        permanent,
      });
      setImpact(result);
      onHighlight(new Set([node.id, ...result.affected.map((a) => a.node_id)]));
      push(`Frozen ${node.label} — ${result.total_affected} service${result.total_affected === 1 ? "" : "s"} affected`, "success");
      onNodeMutated();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setImpactLoading(false);
      setShowConfirmFreeze(false);
    }
  }

  async function handleUnfreeze() {
    try {
      await api.post(`/projects/${project.id}/freeze/unfreeze`, { node_id: node.id });
      push(`${node.label} unfrozen`, "success");
      setImpact(null);
      onHighlight(new Set());
      onNodeMutated();
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const comment = await api.post(`/projects/${project.id}/nodes/${node.id}/comments`, {
        body: newComment,
        is_suggestion: isSuggestion,
      });
      setComments((c) => [...c, comment]);
      setNewComment("");
      setIsSuggestion(false);
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function reviewSuggestion(commentId, approve) {
    try {
      const updated = await api.post(`/projects/${project.id}/comments/${commentId}/review`, { approve });
      setComments((cs) => cs.map((c) => (c.id === commentId ? updated : c)));
    } catch (err) {
      push(err.message, "error");
    }
  }

  function renderCommentBody(body) {
    // Bold @mentions of known project members so they stand out.
    if (!members || members.length === 0) return body;
    const names = members.map((m) => m.full_name).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`(@(?:${names.map(escapeRegex).join("|")}))`, "g");
    const parts = body.split(pattern);
    return parts.map((part, i) =>
      part.startsWith("@") && names.some((n) => part === `@${n}`) ? (
        <strong key={i} style={{ color: "var(--accent)" }}>{part}</strong>
      ) : (
        part
      )
    );
  }

  return (
    <>
      <div className="detail-section">
        <div className="detail-label">
          {node.method ? `${node.method} ${node.path}` : node.node_type.toUpperCase()}
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>{node.label}</div>
        <StatusBadge status={node.freeze_status} />
        {node.is_permanently_frozen && (
          <span className="role-chip" style={{ marginLeft: 6 }}>Project freeze</span>
        )}
        {node.description && (
          <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 10 }}>{node.description}</p>
        )}
        <div className="detail-row"><span className="k">Type</span><span className="v">{node.node_type}</span></div>
        <div className="detail-row"><span className="k">Source</span><span className="v">{node.source === "openapi" ? "OpenAPI import" : node.source === "snapshot_restore" ? "Snapshot restore" : "Manual"}</span></div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Focus / isolate</div>
        <div className="field" style={{ marginBottom: 8 }}>
          <select value={focusRadius} onChange={(e) => setFocusRadius(e.target.value)}>
            <option value="1">Immediate neighbors</option>
            <option value="2">2 levels</option>
            <option value="3">3 levels</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn-sm" onClick={runFocus} disabled={focusLoading}>
            Isolate
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => onHighlight(new Set())}>
            Clear focus
          </button>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-label">Impact / freeze analysis</div>
        <div className="field" style={{ marginBottom: 8 }}>
          <select value={direction} onChange={(e) => setDirection(e.target.value)}>
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 8 }}>
          <select value={depth} onChange={(e) => setDepth(e.target.value)}>
            {DEPTH_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="field" style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: "var(--ink-500)" }}>What are you changing?</label>
          <select value={changeMode} onChange={(e) => setChangeMode(e.target.value)}>
            {CHANGE_IMPACT_MODES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          <button className="btn btn-sm" onClick={runPreview} disabled={impactLoading}>
            Preview impact
          </button>
          {node.freeze_status === "active" || node.freeze_status === "impacted" ? (
            <button
              className="btn btn-sm btn-freeze"
              onClick={() => (canPermanentFreeze ? setShowConfirmFreeze(true) : applyFreeze(false))}
              disabled={!canEdit || impactLoading}
              title={!canEdit ? "Viewers cannot freeze nodes" : undefined}
            >
              Freeze
            </button>
          ) : (
            <button className="btn btn-sm" onClick={handleUnfreeze} disabled={!canEdit}>
              Unfreeze
            </button>
          )}
          <button className="btn btn-sm" onClick={() => setShowSimulate(true)}>Simulate removal/failure</button>
          <button className="btn btn-sm" onClick={() => setShowFreezePlan(true)}>Freeze plan</button>
        </div>

        {impact && (
          <div>
            <div className="detail-row">
              <span className="k">Direct dependencies</span>
              <span className="v">{impact.direct_count}</span>
            </div>
            <div className="detail-row">
              <span className="k">Indirect dependencies</span>
              <span className="v">{impact.indirect_count}</span>
            </div>
            <div className="detail-row">
              <span className="k">Total affected</span>
              <span className="v">{impact.total_affected}</span>
            </div>
            {impact.affected.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div className="detail-label">Why each service is affected</div>
                {impact.affected.map((a) => (
                  <div
                    key={a.node_id}
                    className="impact-path"
                    style={{ cursor: "pointer" }}
                    onClick={() => onFocusChain(a.path.map((_, i, arr) => arr[i]))}
                    title="Click to highlight this dependency chain on the graph"
                  >
                    {a.path.join(" → ")}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="detail-section">
        <div className="detail-label">Comments</div>
        {comments.length === 0 && <p style={{ fontSize: 12.5, color: "var(--ink-500)" }}>No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <span className="comment-author">{c.author_name}</span>
            <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
            {c.is_suggestion && (
              <span
                className={`badge badge-${c.suggestion_status === "approved" ? "green" : c.suggestion_status === "rejected" ? "red" : "amber"}`}
                style={{ marginLeft: 6 }}
              >
                <span className="badge-dot" />suggestion: {c.suggestion_status}
              </span>
            )}
            <div>{renderCommentBody(c.body)}</div>
            {c.is_suggestion && c.suggestion_status === "pending" && isLeader && (
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <button className="btn btn-sm" onClick={() => reviewSuggestion(c.id, true)}>Approve</button>
                <button className="btn btn-sm btn-ghost" onClick={() => reviewSuggestion(c.id, false)}>Reject</button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <form onSubmit={handleAddComment} style={{ marginTop: 10 }}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment — use @Full Name to mention a teammate…"
              style={{ minHeight: 50, marginBottom: 6 }}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8, color: "var(--ink-700)" }}>
              <input type="checkbox" checked={isSuggestion} onChange={(e) => setIsSuggestion(e.target.checked)} style={{ width: "auto" }} />
              Flag as a suggested change (needs Leader approval)
            </label>
            <button className="btn btn-sm btn-primary" type="submit">
              {isSuggestion ? "Submit suggestion" : "Comment"}
            </button>
          </form>
        )}
      </div>

      {canDelete && node.source === "manual" && (
        <div className="detail-section">
          <button className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node)}>
            Delete node
          </button>
        </div>
      )}

      {showConfirmFreeze && (
        <FreezeConfirm
          node={node}
          onCancel={() => setShowConfirmFreeze(false)}
          onTemporary={() => applyFreeze(false)}
          onPermanent={() => applyFreeze(true)}
        />
      )}
      {showSimulate && (
        <SimulateModal
          projectId={project.id}
          node={node}
          onClose={() => setShowSimulate(false)}
          onFocusChain={onHighlight}
        />
      )}
      {showFreezePlan && (
        <FreezePlanModal projectId={project.id} node={node} onClose={() => setShowFreezePlan(false)} />
      )}
    </>
  );
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function FreezeConfirm({ node, onCancel, onTemporary, onPermanent }) {
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal" style={{ width: 420 }}>
        <div className="modal-header">
          <h2>Freeze {node.label}</h2>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 13, marginTop: 0 }}>
            A temporary freeze only visualizes impact on the graph and can be lifted by any member.
            A permanent project freeze records this service as actually frozen for the whole team.
          </p>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={onTemporary}>Temporary (visualize only)</button>
          <button className="btn btn-freeze" onClick={onPermanent}>Permanent project freeze</button>
        </div>
      </div>
    </div>
  );
}
