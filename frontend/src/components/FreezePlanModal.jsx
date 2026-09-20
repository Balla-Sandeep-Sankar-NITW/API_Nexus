import { useEffect, useState } from "react";
import Modal from "./Modal";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";

const STEP_STATUSES = ["pending", "frozen", "testing", "verified", "unfrozen"];

const STATUS_BADGE = {
  pending: "gray",
  frozen: "red",
  testing: "amber",
  verified: "green",
  unfrozen: "gray",
};

export default function FreezePlanModal({ projectId, node, onClose }) {
  const [plans, setPlans] = useState(null);
  const [creating, setCreating] = useState(false);
  const { push } = useToast();

  function load() {
    api.get(`/projects/${projectId}/freeze-plans`).then(setPlans).catch((err) => push(err.message, "error"));
  }

  useEffect(load, [projectId]);

  async function handleGenerate() {
    setCreating(true);
    try {
      await api.post(`/projects/${projectId}/freeze-plans`, { node_id: node.id, direction: "dependents" });
      push("Freeze plan generated", "success");
      load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setCreating(false);
    }
  }

  async function updateStep(planId, stepId, status) {
    try {
      await api.patch(`/projects/${projectId}/freeze-plans/${planId}/steps/${stepId}`, { status });
      load();
    } catch (err) {
      push(err.message, "error");
    }
  }

  const relevantPlans = plans?.filter((p) => p.target_node_id === node.id) || [];

  return (
    <Modal
      title={`Freeze plan: ${node.label}`}
      onClose={onClose}
      width="520px"
      footer={
        <>
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={creating}>
            {creating ? "Generating…" : "Generate new plan"}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 12.5, color: "var(--ink-500)", marginTop: 0 }}>
        An ordered rollout checklist: freeze the target first, then each affected service in dependency order,
        tracking each through Pending → Frozen → Testing → Verified.
      </p>

      {plans === null && <div className="loading-row"><span className="spinner" />Loading…</div>}

      {plans && relevantPlans.length === 0 && (
        <p style={{ fontSize: 13 }}>No freeze plan yet for this node. Generate one to get an ordered checklist.</p>
      )}

      {relevantPlans.map((plan) => (
        <div key={plan.id} className="panel" style={{ marginBottom: 12 }}>
          <div className="panel-header">
            <span style={{ fontSize: 12.5, color: "var(--ink-500)" }}>
              Generated {new Date(plan.created_at).toLocaleString()}
            </span>
          </div>
          <div className="panel-body">
            {plan.steps.map((step, i) => (
              <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                <span style={{ fontSize: 11, color: "var(--ink-300)", width: 18 }}>{i + 1}.</span>
                <span style={{ flex: 1, fontSize: 13 }}>{step.label}{step.depth === 0 ? " (target)" : ` — depth ${step.depth}`}</span>
                <select
                  value={step.status}
                  onChange={(e) => updateStep(plan.id, step.id, e.target.value)}
                  style={{ fontSize: 12, padding: "3px 6px" }}
                >
                  {STEP_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <span className={`badge badge-${STATUS_BADGE[step.status]}`}><span className="badge-dot" /></span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}
