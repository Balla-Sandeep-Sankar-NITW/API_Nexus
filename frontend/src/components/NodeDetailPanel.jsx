import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import StatusBadge from "./StatusBadge";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import EditNodeModal from "./EditNodeModal";
import EditEdgeModal from "./EditEdgeModal";
import { EDGE_TYPES, edgeTypeLabel } from "../utils/graphTypes";

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

const SUGGESTION_BADGE = { pending: "badge-amber", approved: "badge-green", rejected: "badge-gray" };

export default function NodeDetailPanel({
  project,
  graph,
  node,
  risk,
  myRole,
  onFocusChain,
  onHighlight,
  onNodeMutated,
  onGraphEdited,
  onSelectNode,
  onOpenPlans,
  onDeleteNode,
  onBack,
}) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [asSuggestion, setAsSuggestion] = useState(false);
  const [members, setMembers] = useState([]);
  const [direction, setDirection] = useState("dependents");
  const [depth, setDepth] = useState("all");
  const [edgeTypes, setEdgeTypes] = useState(new Set()); // empty = follow every link type
  const [impact, setImpact] = useState(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [focusRadius, setFocusRadius] = useState("1");
  const [focusLoading, setFocusLoading] = useState(false);
  const [simMode, setSimMode] = useState("removal");
  const [sim, setSim] = useState(null);
  const [simLoading, setSimLoading] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [removal, setRemoval] = useState(null);
  const [removalLoading, setRemovalLoading] = useState(false);
  const [showConfirmFreeze, setShowConfirmFreeze] = useState(false);
  const [editNode, setEditNode] = useState(false);
  const [editEdge, setEditEdge] = useState(null);
  const [removeEdge, setRemoveEdge] = useState(null);
  const { push } = useToast();

  const canEdit = myRole === "leader" || myRole === "member";
  const canDelete = myRole === "leader";
  const canPermanentFreeze = myRole === "leader";
  const canReview = myRole === "leader";

  useEffect(() => {
    setImpact(null);
    setSim(null);
    setRemoval(null);
    setAsSuggestion(false);
    onHighlight(new Set());
    if (!node) return;
    api
      .get(`/projects/${project.id}/nodes/${node.id}/comments`)
      .then(setComments)
      .catch(() => setComments([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node?.id]);

  // Teammates available for @mentions; the backend matches "@Full Name".
  useEffect(() => {
    if (!canEdit) return;
    api.get(`/projects/${project.id}/members`).then(setMembers).catch(() => setMembers([]));
  }, [project.id, canEdit]);

  if (!node) {
    return (
      <div className="detail-empty">
        <strong>No node selected</strong>
        Select a node to view its details, run impact analysis, or freeze it.
      </div>
    );
  }

  const depthValue = depth === "all" ? null : Number(depth);
  const edgeTypeBody = edgeTypes.size > 0 ? { edge_types: [...edgeTypes] } : {};
  const labelOf = Object.fromEntries(graph.nodes.map((n) => [n.id, n.label]));
  // The API returns each chain as labels; the canvas highlights by node id.
  const idByLabel = Object.fromEntries(graph.nodes.map((n) => [n.label, n.id]));
  const chainIds = (labels) => labels.map((l) => idByLabel[l]).filter(Boolean);
  const outgoing = graph.edges.filter((e) => e.source_node_id === node.id);
  const incoming = graph.edges.filter((e) => e.target_node_id === node.id);

  function toggleEdgeType(value) {
    setEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  async function runFocus() {
    setFocusLoading(true);
    try {
      const radius = Number(focusRadius);
      const [deps, dependents] = await Promise.all([
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependencies", depth: radius }),
        api.post(`/projects/${project.id}/impact/preview`, { node_id: node.id, direction: "dependents", depth: radius }),
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
        depth: depthValue,
        ...edgeTypeBody,
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
        depth: depthValue,
        permanent,
        ...edgeTypeBody,
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

  // What-if: non-destructive. "orphaned" is the stronger subset that would
  // lose every one of its dependencies, not just one of them.
  async function runSimulate() {
    setSimLoading(true);
    try {
      const result = await api.post(`/projects/${project.id}/simulate`, {
        node_id: node.id,
        mode: simMode,
        direction: "dependents",
        depth: depthValue,
      });
      setSim(result);
      onHighlight(new Set([node.id, ...result.affected.map((a) => a.node_id)]));
    } catch (err) {
      push(err.message, "error");
    } finally {
      setSimLoading(false);
    }
  }

  async function runRemovalCheck() {
    setRemovalLoading(true);
    try {
      setRemoval(await api.get(`/projects/${project.id}/nodes/${node.id}/removal-check`));
    } catch (err) {
      push(err.message, "error");
    } finally {
      setRemovalLoading(false);
    }
  }

  async function createPlan() {
    setPlanLoading(true);
    try {
      const plan = await api.post(`/projects/${project.id}/freeze-plans`, { node_id: node.id, direction, depth: depthValue });
      push(`Freeze plan created with ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}`, "success");
      onOpenPlans();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setPlanLoading(false);
    }
  }

  async function handleAddComment(e) {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      const comment = await api.post(`/projects/${project.id}/nodes/${node.id}/comments`, {
        body: newComment,
        is_suggestion: asSuggestion,
      });
      setComments((c) => [...c, comment]);
      setNewComment("");
      setAsSuggestion(false);
      if (asSuggestion) push("Suggestion sent to the project leaders for review", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  function insertMention(name) {
    if (!name) return;
    setNewComment((c) => `${c && !c.endsWith(" ") ? `${c} ` : c}@${name} `);
  }

  async function handleReview(comment, approve) {
    try {
      const updated = await api.post(`/projects/${project.id}/comments/${comment.id}/review`, { approve });
      setComments((list) => list.map((c) => (c.id === comment.id ? updated : c)));
      push(approve ? "Suggestion approved" : "Suggestion rejected", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleRemoveEdge() {
    const edge = removeEdge;
    setRemoveEdge(null);
    try {
      await api.del(`/projects/${project.id}/edges/${edge.id}`);
      push("Link removed", "success");
      onGraphEdited();
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
          {node.deprecated && (
            <span className="badge badge-amber"><span className="badge-dot" aria-hidden="true" />Deprecated</span>
          )}
        </div>
        {node.description && <p className="detail-desc">{node.description}</p>}
        <dl className="kv">
          <dt>Type</dt>
          <dd>{node.node_type}</dd>
          <dt>Source</dt>
          <dd>{node.source === "openapi" ? "OpenAPI import" : "Manual"}</dd>
          {(node.owner_team || node.owner_contact) && (
            <>
              <dt>Owner</dt>
              <dd>{[node.owner_team, node.owner_contact].filter(Boolean).join(", ")}</dd>
            </>
          )}
          {node.deprecated && (
            <>
              <dt>Sunset</dt>
              <dd>{node.sunset_date ? new Date(`${node.sunset_date}T00:00:00`).toLocaleDateString() : "No date set"}</dd>
            </>
          )}
          <dt>Dependents</dt>
          <dd>{incoming.length}</dd>
          <dt>Dependencies</dt>
          <dd>{outgoing.length}</dd>
        </dl>
        {canEdit && (
          <div className="detail-actions">
            <button type="button" className="btn btn-sm" onClick={() => setEditNode(true)}>Edit node</button>
          </div>
        )}
      </section>

      {risk && (
        <section className="detail-section" aria-labelledby="risk-heading">
          <h3 id="risk-heading">Risk</h3>
          <div className="risk-score">
            <span className={`badge risk-${risk.level}`}>{risk.score} / 100</span>
            <span className="text-sm">{risk.level[0].toUpperCase() + risk.level.slice(1)}</span>
          </div>
          {risk.factors.length === 0 ? (
            <p className="text-sm text-muted" style={{ margin: "var(--sp-2) 0 0" }}>Nothing depends on this and it has no known gaps.</p>
          ) : (
            <ul className="factor-list">
              {risk.factors.map((f) => (
                <li key={f.label}>
                  <span className="factor-points">+{f.points}</span>
                  <span><strong>{f.label}.</strong> {f.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <section className="detail-section" aria-labelledby="links-heading">
        <h3 id="links-heading">Links</h3>
        <LinkGroup
          title="Depends on"
          edges={outgoing}
          otherId={(e) => e.target_node_id}
          labelOf={labelOf}
          canEdit={canEdit}
          onSelectNode={onSelectNode}
          onEdit={setEditEdge}
          onRemove={setRemoveEdge}
        />
        <LinkGroup
          title="Used by"
          edges={incoming}
          otherId={(e) => e.source_node_id}
          labelOf={labelOf}
          canEdit={canEdit}
          onSelectNode={onSelectNode}
          onEdit={setEditEdge}
          onRemove={setRemoveEdge}
        />
      </section>

      <details className="detail-fold">
        <summary>Focus</summary>
        <div className="detail-fold-body">
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
      </div>
      </details>

      <details className="detail-fold">
        <summary>Impact analysis</summary>
        <div className="detail-fold-body">
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
        <div className="field">
          <span className="label" id="edge-types-label">Kind of change</span>
          <div className="chip-group" role="group" aria-labelledby="edge-types-label">
            {EDGE_TYPES.map((t) => (
              <button key={t.value} type="button" className="chip" aria-pressed={edgeTypes.has(t.value)} onClick={() => toggleEdgeType(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="field-hint">
            {edgeTypes.size === 0
              ? "Following every kind of link. Pick some to see only what a schema, auth or call change would reach."
              : "Only following the selected kinds of link."}
          </div>
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
          {canEdit && (
            <button type="button" className={`btn btn-sm${planLoading ? " is-loading" : ""}`} onClick={createPlan} disabled={planLoading} title="Create an ordered, trackable freeze plan from the direction and depth above">
              Create freeze plan
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
                      onClick={() => onFocusChain(chainIds(a.path))}
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
      </div>
      </details>

      <details className="detail-fold">
        <summary>What if…</summary>
        <div className="detail-fold-body">
        <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
          See what would break without changing anything. Uses the depth chosen above.
        </p>
        <div className="field">
          <label htmlFor="sim-mode">Scenario</label>
          <select id="sim-mode" value={simMode} onChange={(e) => { setSimMode(e.target.value); setSim(null); }}>
            <option value="removal">This is removed permanently</option>
            <option value="failure">This goes down temporarily</option>
          </select>
        </div>
        <div className="detail-actions">
          <button type="button" className={`btn btn-sm${simLoading ? " is-loading" : ""}`} onClick={runSimulate} disabled={simLoading}>
            Run simulation
          </button>
        </div>
        {sim && (
          <div className="impact-summary" aria-live="polite">
            <dl className="kv">
              <dt>{sim.mode === "removal" ? "Would be affected" : "Would be disrupted"}</dt>
              <dd>{sim.total_affected}</dd>
              <dt>Left with no dependencies</dt>
              <dd>{sim.total_orphaned}</dd>
            </dl>
            {sim.total_affected === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>Nothing depends on this node.</p>}
            {sim.orphaned.length > 0 && (
              <>
                <h4>Would lose every dependency</h4>
                <ul className="link-list">
                  {sim.orphaned.map((a) => (
                    <li key={a.node_id}>
                      <button type="button" className="link-btn truncate" onClick={() => onSelectNode(a.node_id)}>{a.label}</button>
                      <span className="text-muted">level {a.depth}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {sim.affected.length > 0 && (
              <>
                <h4>All affected</h4>
                <div className="path-list">
                  {sim.affected.map((a) => (
                    <button type="button" key={a.node_id} className="path-chain" onClick={() => onFocusChain(chainIds(a.path))}>
                      {a.path.join(" → ")}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
      </details>

      <details className="detail-fold">
        <summary>Safe to remove?</summary>
        <div className="detail-fold-body">
        <p className="field-hint" style={{ margin: "0 0 var(--sp-3)" }}>
          Checks whether anything in the graph still depends on this node. It can't see which fields consumers actually read.
        </p>
        <div className="detail-actions">
          <button type="button" className={`btn btn-sm${removalLoading ? " is-loading" : ""}`} onClick={runRemovalCheck} disabled={removalLoading}>
            Check
          </button>
        </div>
        {removal && (
          <div className={`verdict verdict-${removal.verdict}`} aria-live="polite">
            <strong>{removal.verdict === "safe" ? "Safe to remove" : "Not safe to remove yet"}</strong>
            {removal.reasons.map((r) => (
              <div key={r}>{r}</div>
            ))}
            {removal.direct_dependents.length > 0 && (
              <ul>
                {removal.direct_dependents.map((d) => (
                  <li key={d.node_id}>
                    <button type="button" className="link-btn" onClick={() => onSelectNode(d.node_id)}>{d.label}</button>
                  </li>
                ))}
              </ul>
            )}
            {removal.would_be_orphaned.length > 0 && (
              <div style={{ marginTop: "var(--sp-2)" }}>
                Would be left with no dependencies at all: {removal.would_be_orphaned.join(", ")}.
              </div>
            )}
          </div>
        )}
      </div>
      </details>

      <details className="detail-fold">
        <summary>Comments{comments.length > 0 && <span className="fold-count">{comments.length}</span>}</summary>
        <div className="detail-fold-body">
        {comments.length === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="comment-item">
            <div className="comment-meta">
              <span className="comment-author">{c.author_name}</span>
              <span className="comment-time">{new Date(c.created_at).toLocaleString()}</span>
            </div>
            {c.is_suggestion && (
              <div className="suggestion-tag">
                <span className={`badge ${SUGGESTION_BADGE[c.suggestion_status] || "badge-gray"}`}>
                  <span className="badge-dot" aria-hidden="true" />
                  Suggested change · {c.suggestion_status}
                </span>
              </div>
            )}
            <div className="comment-body">{c.body}</div>
            {c.is_suggestion && c.suggestion_status === "pending" && canReview && (
              <div className="detail-actions">
                <button type="button" className="btn btn-sm btn-primary" onClick={() => handleReview(c, true)}>Approve</button>
                <button type="button" className="btn btn-sm" onClick={() => handleReview(c, false)}>Reject</button>
              </div>
            )}
          </div>
        ))}
        {canEdit && (
          <form onSubmit={handleAddComment} className="comment-form">
            <label htmlFor="new-comment" className="sr-only">Add a comment</label>
            <textarea
              id="new-comment"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={asSuggestion ? "Describe the change you'd like made to this node" : "Add a comment or question about this node"}
            />
            <div className="comment-tools">
              <label className="check">
                <input type="checkbox" checked={asSuggestion} onChange={(e) => setAsSuggestion(e.target.checked)} />
                Suggest a change (a leader approves or rejects it)
              </label>
              {members.length > 0 && (
                <select className="select select-sm" aria-label="Mention a teammate" value="" onChange={(e) => insertMention(e.target.value)}>
                  <option value="">Mention…</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.full_name}>{m.full_name}</option>
                  ))}
                </select>
              )}
            </div>
            <button className="btn btn-sm btn-primary" type="submit" disabled={!newComment.trim()}>
              {asSuggestion ? "Send suggestion" : "Comment"}
            </button>
          </form>
        )}
      </div>
      </details>

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
      {editNode && <EditNodeModal projectId={project.id} node={node} onClose={() => setEditNode(false)} onSaved={onNodeMutated} />}
      {editEdge && (
        <EditEdgeModal
          projectId={project.id}
          edge={editEdge}
          sourceLabel={labelOf[editEdge.source_node_id]}
          targetLabel={labelOf[editEdge.target_node_id]}
          onClose={() => setEditEdge(null)}
          onSaved={onGraphEdited}
        />
      )}
      {removeEdge && (
        <ConfirmDialog
          title="Remove link"
          message={`Remove the link between "${labelOf[removeEdge.source_node_id]}" and "${labelOf[removeEdge.target_node_id]}"? Impact analysis will no longer follow it.`}
          confirmLabel="Remove link"
          danger
          onConfirm={handleRemoveEdge}
          onCancel={() => setRemoveEdge(null)}
        />
      )}
    </>
  );
}

function LinkGroup({ title, edges, otherId, labelOf, canEdit, onSelectNode, onEdit, onRemove }) {
  return (
    <div className="link-group">
      <h4>{title} ({edges.length})</h4>
      {edges.length === 0 ? (
        <p className="text-sm text-muted" style={{ margin: 0 }}>None.</p>
      ) : (
        <ul className="link-list">
          {edges.map((e) => (
            <li key={e.id}>
              <button type="button" className="link-btn truncate" onClick={() => onSelectNode(otherId(e))} title={e.description || undefined}>
                {labelOf[otherId(e)] || "Unknown"}
              </button>
              <span className="text-muted link-type">{edgeTypeLabel(e.edge_type)}</span>
              {canEdit && (
                <span className="link-actions">
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onEdit(e)}>Edit</button>
                  <button type="button" className="btn btn-sm btn-ghost" onClick={() => onRemove(e)}>Remove</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
