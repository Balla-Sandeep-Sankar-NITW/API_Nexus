import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";

export default function MembersPanel({ projectId, myRole }) {
  const [members, setMembers] = useState(null);
  const [showInvite, setShowInvite] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState("");
  const [removeTarget, setRemoveTarget] = useState(null);
  const { push } = useToast();
  const isLeader = myRole === "leader";

  function load() {
    api.get(`/projects/${projectId}/members`).then(setMembers).catch((err) => push(err.message, "error"));
  }

  useEffect(load, [projectId]);

  async function handleInvite(e) {
    e.preventDefault();
    setError("");
    try {
      await api.post(`/projects/${projectId}/members`, { email, role });
      push(`${email} added to project`, "success");
      setShowInvite(false);
      setEmail("");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await api.patch(`/projects/${projectId}/members/${memberId}`, { role: newRole });
      push("Role updated", "success");
      load();
    } catch (err) {
      push(err.message, "error");
    }
  }

  async function handleRemove() {
    try {
      await api.del(`/projects/${projectId}/members/${removeTarget.id}`);
      push(`${removeTarget.full_name} removed from project`, "success");
      setRemoveTarget(null);
      load();
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div className="toolbar-spacer" />
        {isLeader && (
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>
            Add member
          </button>
        )}
      </div>

      {members === null && <div className="loading-row"><span className="spinner" />Loading members…</div>}

      {members && (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Joined</th>
              {isLeader && <th></th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.full_name}</td>
                <td>{m.email}</td>
                <td>
                  {isLeader ? (
                    <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)} style={{ padding: "4px 8px", fontSize: 12.5 }}>
                      <option value="leader">Leader</option>
                      <option value="member">Member</option>
                      <option value="viewer">Viewer</option>
                    </select>
                  ) : (
                    <span className="role-chip" style={{ textTransform: "capitalize" }}>{m.role}</span>
                  )}
                </td>
                <td>{new Date(m.joined_at).toLocaleDateString()}</td>
                {isLeader && (
                  <td>
                    <button className="btn btn-sm btn-ghost" onClick={() => setRemoveTarget(m)}>Remove</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showInvite && (
        <Modal
          title="Add team member"
          onClose={() => setShowInvite(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowInvite(false)}>Cancel</button>
              <button className="btn btn-primary" form="invite-form" type="submit">Add member</button>
            </>
          }
        >
          {error && <div className="auth-error">{error}</div>}
          <form id="invite-form" onSubmit={handleInvite}>
            <div className="field">
              <label htmlFor="invite-email">Email</label>
              <input id="invite-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="teammate@company.com" required autoFocus />
              <div className="field-hint">They must already have an API Nexus account.</div>
            </div>
            <div className="field">
              <label htmlFor="invite-role">Role</label>
              <select id="invite-role" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="member">Member — can add nodes and links</option>
                <option value="viewer">Viewer — read only</option>
                <option value="leader">Leader — full control</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {removeTarget && (
        <ConfirmDialog
          title="Remove member"
          message={`Remove ${removeTarget.full_name} from this project? They will lose access immediately.`}
          confirmLabel="Remove"
          danger
          onConfirm={handleRemove}
          onCancel={() => setRemoveTarget(null)}
        />
      )}
    </div>
  );
}
