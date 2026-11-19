import { useState } from "react";
import Modal from "./Modal";
import Alert from "./ui/Alert";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { NODE_TYPES } from "../utils/graphTypes";

// PATCH /projects/{id}/nodes/{nodeId}: name, description, type, who owns it,
// and whether it is deprecated (with a sunset date).
export default function EditNodeModal({ projectId, node, onClose, onSaved }) {
  const [label, setLabel] = useState(node.label);
  const [description, setDescription] = useState(node.description || "");
  const [nodeType, setNodeType] = useState(node.node_type);
  const [ownerTeam, setOwnerTeam] = useState(node.owner_team || "");
  const [ownerContact, setOwnerContact] = useState(node.owner_contact || "");
  const [deprecated, setDeprecated] = useState(!!node.deprecated);
  const [sunset, setSunset] = useState(node.sunset_date || "");
  const [note, setNote] = useState(node.deprecation_note || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { push } = useToast();

  const dirty =
    label.trim() !== node.label ||
    description !== (node.description || "") ||
    nodeType !== node.node_type ||
    ownerTeam.trim() !== (node.owner_team || "") ||
    ownerContact.trim() !== (node.owner_contact || "") ||
    deprecated !== !!node.deprecated ||
    (deprecated && (sunset !== (node.sunset_date || "") || note !== (node.deprecation_note || "")));

  async function handleSubmit(e) {
    e.preventDefault();
    if (!label.trim()) return;
    setError("");
    setSaving(true);
    try {
      const updated = await api.patch(`/projects/${projectId}/nodes/${node.id}`, {
        label: label.trim(),
        description,
        node_type: nodeType,
        owner_team: ownerTeam,
        owner_contact: ownerContact,
        deprecated,
        sunset_date: deprecated && sunset ? sunset : null,
        deprecation_note: deprecated ? note : "",
      });
      push(deprecated && !node.deprecated ? "Marked as deprecated. Owners of dependent components were notified." : "Node updated", "success");
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Edit node"
      onClose={onClose}
      width="480px"
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn btn-primary${saving ? " is-loading" : ""}`} form="edit-node-form" type="submit" disabled={saving || !dirty || !label.trim()} aria-busy={saving}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      {error && <Alert>{error}</Alert>}
      <form id="edit-node-form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="en-label">Name</label>
          <input id="en-label" value={label} onChange={(e) => setLabel(e.target.value)} maxLength={200} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="en-type">Type</label>
          <select id="en-type" value={nodeType} onChange={(e) => setNodeType(e.target.value)}>
            {NODE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="en-desc">Description</label>
          <textarea id="en-desc" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <fieldset className="form-group">
          <legend>Ownership</legend>
          <div className="field-row">
            <div className="field">
              <label htmlFor="en-team">Owning team</label>
              <input id="en-team" value={ownerTeam} onChange={(e) => setOwnerTeam(e.target.value)} maxLength={120} placeholder="Payments" />
            </div>
            <div className="field">
              <label htmlFor="en-contact">Contact</label>
              <input id="en-contact" value={ownerContact} onChange={(e) => setOwnerContact(e.target.value)} maxLength={200} placeholder="name@company.com" />
            </div>
          </div>
          <div className="field-hint">If the contact is the email of a project member, they're notified when this node is affected by a permanent freeze or a deprecation.</div>
        </fieldset>

        <fieldset className="form-group">
          <legend>Lifecycle</legend>
          <label className="check">
            <input type="checkbox" checked={deprecated} onChange={(e) => setDeprecated(e.target.checked)} />
            This is deprecated and should be phased out
          </label>
          {deprecated && (
            <>
              <div className="field" style={{ marginTop: "var(--sp-3)" }}>
                <label htmlFor="en-sunset">Sunset date</label>
                <input id="en-sunset" type="date" value={sunset} onChange={(e) => setSunset(e.target.value)} />
                <div className="field-hint">The date after which nothing should depend on it.</div>
              </div>
              <div className="field">
                <label htmlFor="en-note">Note for consumers</label>
                <input id="en-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Use /v2/orders instead" />
              </div>
            </>
          )}
        </fieldset>
      </form>
    </Modal>
  );
}
