import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusBadge from "./StatusBadge";
import Modal from "./Modal";

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

export default function NodeDetailPanel({
  project,
  node,
  myRole,
  onFocusChain,
  onHighlight,
  onNodeMutated,
  onDeleteNode,
  onBack,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [direction, setDirection] = useState("dependents");
  const [depth, setDepth] = useState("all");
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [focusRadius, setFocusRadius] = useState("1");
  const [focusLoading, setFocusLoading] = useState(false);
  const [showConfirmFreeze, setShowConfirmFreeze] = useState(false);
  const { push } = useToast();

  const canEdit = myRole === "leader" || myRole === "member";
  const canDelete = myRole === "leader";
  const canPermanentFreeze = myRole === "leader";

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
    return (
      <div className="detail-empty">
        <strong>No node selected</strong>
        Select a node to view its details, run impact analysis, or freeze it.
      </div>
    );
  }

  async function runFocus() {
    setFocusLoading(true);
    try {
      const depth = Number(focusRadius);
      const [deps, dependents] = await Promise.all([
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependencies", depth }),
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependents", depth }),
      ]);
      const ids = new Set([node.id, ...deps.affected.map((a) => a.node_id), ...dependents.affected.map((a) => a.node_id)]);
      onHighlight(ids);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setFocusLoading(false);
    }
  }

  async function runPreview() {
    setImpactLoading(true);
    try {
      const result = await api.post(`/projects/${project.id}/impact/preview`, {
        node_id: node.id,
        direction,
        depth: depth === "all" ? null : Number(depth),
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
      const comment = await api.post(`/projects/${project.id}/nodes/${node.id}/comments`, { body: newComment });
      setComments((c) => [...c, comment]);
      setNewComment("");
    } catch (err) {
      push(err.message, "error");
    }
  }

  const canFreeze = node.freeze_status === "active" || node.freeze_status === "impacted";

  return (
    <>
      <section className="detail-section" aria-label="Node details">
        {onBack && (
          <button type="button" className="btn btn-sm detail-back" onClick={onBack}>
            Back to graph
          </button>
        )}
        <div className="detail-subtitle text-muted">
          {node.method && node.label !== `${node.method} ${node.path}` ? (
            <>
              <span className={`method-tag method-${node.method}`}>{node.method}</span> <span className="mono">{node.path}</span>
            </>
          ) : node.method ? null : (
            node.node_type
          )}
        </div>
        <h2 className="detail-title">{node.label}</h2>
        <div className="detail-badges">
          <StatusBadge status={node.freeze_status} />
          {node.is_permanently_frozen && <span className="role-chip">Project freeze</span>}
        </div>
        {node.description && <p className="detail-desc">{node.description}</p>}
        <dl className="kv">
          <dt>Type</dt>
          <dd>{node.node_type}</dd>
          <dt>Source</dt>
          <dd>{node.source === "openapi" ? "OpenAPI import" : "Manual"}</dd>
        </dl>
      </section>

      <section className="detail-section" aria-labelledby="focus-heading">
        <h3 id="focus-heading">Focus</h3>
        <div className="field">
          <label htmlFor="focus-radius">Show neighbors within</label>
          <select id="focus-radius" value={focusRadius} onChange={(e) => setFocusRadius(e.target.value)}>
            <option value="1">Immediate neighbors</option>
            <option value="2">2 levels</option>
            <option value="3">3 levels</option>
          </select>
        </div>
        <div className="detail-actions">
          <button type="button" className={`btn btn-sm${focusLoading ? " is-loading" : ""}`} onClick={runFocus} disabled={focusLoading}>
            Isolate
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => onHighlight(new Set())}>
            Clear focus
          </button>
        </div>
      </section>

      <section className="detail-section" aria-labelledby="impact-heading">
        <h3 id="impact-heading">Impact analysis</h3>
        <div className="field">
          <label htmlFor="impact-direction">Direction</label>
          <select id="impact-direction" value={direction} onChange={(e) => setDirection(e.target.value)}>
            {DIRECTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="impact-depth">Depth</label>
          <select id="impact-depth" value={depth} onChange={(e) => setDepth(e.target.value)}>
            {DEPTH_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div className="detail-actions">
          <button type="button" className={`btn btn-sm${impactLoading ? " is-loading" : ""}`} onClick={runPreview} disabled={impactLoading}>
            Preview impact
          </button>
          {canFreeze ? (
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => (canPermanentFreeze ? setShowConfirmFreeze(true) : applyFreeze(false))}
              disabled={!canEdit || impactLoading}
              title={!canEdit ? "Viewers cannot freeze nodes" : undefined}
            >
              Freeze
            </button>
          ) : (
            <button type="button" className="btn btn-sm" onClick={handleUnfreeze} disabled={!canEdit}>
              Unfreeze
            </button>
          )}
        </div>

        {impact && (
          <div className="impact-summary" aria-live="polite">
            <dl className="kv">
              <dt>Direct dependencies</dt>
              <dd>{impact.direct_count}</dd>
              <dt>Indirect dependencies</dt>
              <dd>{impact.indirect_count}</dd>
              <dt>Total affected</dt>
              <dd>{impact.total_affected}</dd>
            </dl>
            {impact.affected.length > 0 && (
              <>
                <h4>Why each service is affected</h4>
                <div className="path-list">
                  {impact.affected.map((a) => (
                    <button
                      type="button"
                      key={a.node_id}
                      className="path-chain"
                      onClick={() => onFocusChain(a.path.map((_, i, arr) => arr[i]))}
                      title="Highlight this dependency chain on the graph"
                    >
                      {a.path.join(" → ")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="detail-section" aria-labelledby="comments-heading">
        <h3 id="comments-heading">Comments</h3>
        {comments.length === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <div className="comment-meta">
              <span className="comment-author">{c.author_name}</span>
              <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            <div className="comment-body">{c.body}</div>
          </div>
        ))}
        {canEdit && (
          <form onSubmit={handleAddComment} className="comment-form">
            <label htmlFor="new-comment" className="sr-only">Add a comment</label>
            <textarea
              id="new-comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Add a comment or question about this node"
            />
            <button className="btn btn-sm btn-primary" type="submit" disabled={!newComment.trim()}>Comment</button>
          </form>
        )}
      </section>

      {canDelete && node.source === "manual" && (
        <section className="detail-section" aria-label="Danger zone">
          <button type="button" className="btn btn-sm btn-danger" onClick={() => onDeleteNode(node)}>
            Delete node
          </button>
        </section>
      )}

      {showConfirmFreeze && (
        <FreezeConfirm
          node={node}
          onCancel={() => setShowConfirmFreeze(false)}
          onTemporary={() => applyFreeze(false)}
          onPermanent={() => applyFreeze(true)}
        />
      )}
    </>
  );
}

function FreezeConfirm({ node, onCancel, onTemporary, onPermanent }) {
  return (
    <Modal
      title={`Freeze ${node.label}`}
      onClose={onCancel}
      width="440px"
      footer={
        <>
          <button type="button" className="btn" onClick={onCancel}>Cancel</button>
          <button type="button" className="btn" onClick={onTemporary}>Temporary (visualize only)</button>
          <button type="button" className="btn btn-danger-solid" onClick={onPermanent}>Permanent project freeze</button>
        </>
      }
    >
      <p className="text-sm" style={{ color: "var(--ink-700)" }}>
        A temporary freeze only visualizes impact on the graph and can be lifted by any member.
        A permanent project freeze records this service as actually frozen for the whole team.
      </p>
    </Modal>
  );
}
