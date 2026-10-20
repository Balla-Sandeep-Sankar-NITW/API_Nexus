import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import ConfirmDialog from "./ConfirmDialog";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

const STATUSES = [
  { value: "pending", label: "Pending", badge: "badge-gray" },
  { value: "frozen", label: "Frozen", badge: "badge-red" },
  { value: "testing", label: "Testing", badge: "badge-amber" },
  { value: "verified", label: "Verified", badge: "badge-teal" },
  { value: "unfrozen", label: "Unfrozen", badge: "badge-green" },
];
const statusMeta = (v) => STATUSES.find((s) => s.value === v) || STATUSES[0];
const isDone = (step) => step.status === "verified" || step.status === "unfrozen";

const DIRECTION_TEXT = {
  dependents: "everything that depends on it",
  dependencies: "everything it depends on",
};

// A plan is an ordered checklist for rolling a change out: freeze the target, then
// each affected node in turn, then test, verify and unfreeze. Plans start collapsed;
// open one to work through its steps or to delete it. Deleting a plan only removes the
// checklist: it does not change any node's freeze status on the graph.
export default function FreezePlansPanel({ projectId, nodes, myRole, openPlanId = null }) {
  const [plans, setPlans] = useState(null);
  // Plans start collapsed; the one you just created from a node opens by itself.
  const [open, setOpen] = useState(() => new Set(openPlanId ? [openPlanId] : []));
  const [deleteTarget, setDeleteTarget] = useState(null);
  const { push } = useToast();
  const canEdit = myRole === "leader" || myRole === "member";
  const labelOf = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.label])), [nodes]);

  useEffect(() => {
    api
      .get(`/projects/${projectId}/freeze-plans`)
      .then(setPlans)
      .catch((err) => {
        setPlans([]);
        push(err.message, "error");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  function toggle(id) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function setStepStatus(plan, step, status) {
    const previous = step.status;
    const apply = (value) =>
      setPlans((list) =>
        list.map((p) => (p.id === plan.id ? { ...p, steps: p.steps.map((s) => (s.id === step.id ? { ...s, status: value } : s)) } : p))
      );
    apply(status); // optimistic
    try {
      await api.patch(`/projects/${projectId}/freeze-plans/${plan.id}/steps/${step.id}`, { status });
    } catch (err) {
      apply(previous);
      push(err.message, "error");
    }
  }

  async function handleDelete() {
    const plan = deleteTarget;
    setDeleteTarget(null);
    try {
      await api.del(`/projects/${projectId}/freeze-plans/${plan.id}`);
      setPlans((list) => list.filter((p) => p.id !== plan.id));
      push("Freeze plan deleted", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  if (plans === null) return <LoadingRow>Loading freeze plans…</LoadingRow>;

  if (plans.length === 0) {
    return (
      <EmptyState title="No freeze plans yet">
        Select a node on the graph and choose "Create freeze plan" to get an ordered list of what to freeze, test and release.
      </EmptyState>
    );
  }

  return (
    <>
      {plans.map((plan) => {
        const target = labelOf[plan.target_node_id] || "a deleted node";
        const done = plan.steps.filter(isDone).length;
        const total = plan.steps.length;
        const finished = total > 0 && done === total;
        const expanded = open.has(plan.id);
        const panelId = `plan-${plan.id}`;
        const tally = STATUSES.map((s) => ({ ...s, count: plan.steps.filter((st) => st.status === s.value).length })).filter((s) => s.count > 0);
        return (
          <section className={`plan-card${expanded ? " is-open" : ""}`} key={plan.id} aria-label={`Freeze plan for ${target}`}>
            <button type="button" className="plan-head" aria-expanded={expanded} aria-controls={panelId} onClick={() => toggle(plan.id)}>
              <span className="plan-title">
                <strong>{target}</strong>
                {finished && <span className="badge badge-green"><span className="badge-dot" aria-hidden="true" />All steps done</span>}
              </span>
              <span className="plan-meta">
                {done} of {total} step{total === 1 ? "" : "s"} done · created {new Date(plan.created_at).toLocaleDateString()}
              </span>
              <span className="plan-progress" aria-hidden="true"><span style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></span>
              <span className="plan-chevron" aria-hidden="true" />
            </button>

            {expanded && (
              <div className="plan-body" id={panelId}>
                <p className="plan-scope">Covers {DIRECTION_TEXT[plan.direction] || plan.direction}. Steps run top to bottom.</p>
                <div className="finding-counts">
                  {tally.map((s) => (
                    <span key={s.value} className={`badge ${s.badge}`}>
                      <span className="badge-dot" aria-hidden="true" />
                      {s.count} {s.label.toLowerCase()}
                    </span>
                  ))}
                </div>
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col" className="num">Order</th>
                        <th scope="col">Node</th>
                        <th scope="col" className="hide-narrow">Distance</th>
                        <th scope="col">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.steps.map((step) => (
                        <tr key={step.id}>
                          <td className="num tabular" data-label="Order">{step.order_index + 1}</td>
                          <td className="primary">{step.label}</td>
                          <td className="text-muted hide-narrow" data-label="Distance">{step.depth === 0 ? "Target" : step.depth === 1 ? "Direct" : `Level ${step.depth}`}</td>
                          <td data-label="Status">
                            {canEdit ? (
                              <select
                                className="select select-sm"
                                aria-label={`Status for ${step.label}`}
                                value={step.status}
                                onChange={(e) => setStepStatus(plan, step, e.target.value)}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s.value} value={s.value}>{s.label}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`badge ${statusMeta(step.status).badge}`}>
                                <span className="badge-dot" aria-hidden="true" />
                                {statusMeta(step.status).label}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {canEdit && (
                  <div className="plan-actions">
                    <span className="field-hint">
                      {finished
                        ? "Every step is verified or unfrozen, so this plan has done its job. You can delete it."
                        : "Created by mistake or no longer needed? Deleting only removes this checklist."}
                    </span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={() => setDeleteTarget(plan)}>
                      Delete plan
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete freeze plan"
          message={`Delete the plan for "${labelOf[deleteTarget.target_node_id] || "this node"}" and its ${deleteTarget.steps.length} steps? This only removes the checklist. Nothing is unfrozen on the graph.`}
          confirmLabel="Delete plan"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
