import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
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

const DIRECTION_TEXT = {
  dependents: "everything that depends on it",
  dependencies: "everything it depends on",
};

// Ordered freeze steps for a change, with a status per step. Plans are created
// from a node's "Create freeze plan" action; steps run target first, then by depth.
export default function FreezePlansPanel({ projectId, nodes, myRole }) {
  const [plans, setPlans] = useState(null);
  const { push } = useToast();
  const canEdit = myRole === "leader" || myRole === "member";
  const labelOf = useMemo(() => Object.fromEntries(nodes.map((n) => [n.id, n.label])), [nodes]);

  useEffect(() => {
    api.get(`/projects/${projectId}/freeze-plans`).then(setPlans).catch((err) => {
      setPlans([]);
      push(err.message, "error");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

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
        const tally = STATUSES.map((s) => ({ ...s, count: plan.steps.filter((st) => st.status === s.value).length })).filter((s) => s.count > 0);
        const target = labelOf[plan.target_node_id] || "a deleted node";
        return (
          <section className="section plan" key={plan.id} aria-label={`Freeze plan for ${target}`}>
            <div className="section-head">
              <h2>{target}</h2>
              <p>
                Covers {DIRECTION_TEXT[plan.direction] || plan.direction} · created {new Date(plan.created_at).toLocaleString()}
              </p>
            </div>
            <div className="finding-counts">
              {tally.map((s) => (
                <span key={s.value} className={`badge ${s.badge}`}>
                  <span className="badge-dot" aria-hidden="true" />
                  {s.count} {s.label.toLowerCase()}
                </span>
              ))}
            </div>
            <div className="table-wrap stack">
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
          </section>
        );
      })}
    </>
  );
}
