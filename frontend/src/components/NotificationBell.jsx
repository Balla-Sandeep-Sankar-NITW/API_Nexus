import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Icon from "./ui/Icon";

const POLL_MS = 60000;

const TYPE_LABEL = {
  mention: "Mention",
  role_change: "Role change",
  member_added: "New member",
  node_frozen: "Freeze",
  spec_imported: "Import",
  suggestion: "Suggestion",
};

function timeAgo(iso) {
  const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// Bell with an unread count and a popover list. Polls quietly so new mentions,
// role changes, freezes, imports and suggestion reviews show up without a reload.
export default function NotificationBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const { push } = useToast();
  const navigate = useNavigate();

  const load = useCallback(() => {
    api.get("/me/notifications").then(setItems).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      const r = buttonRef.current.getBoundingClientRect();
      const narrow = window.innerWidth <= 860;
      setPos(narrow ? { top: r.bottom + 8, left: 8, right: 8 } : { top: Math.max(8, r.top - 8), left: r.right + 8, width: 360 });
      load();
    }
    setOpen((o) => !o);
  }

  const unread = items.filter((n) => !n.read).length;

  async function markRead(n) {
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      api.post(`/me/notifications/${n.id}/read`).catch(() => load());
    }
    if (n.project_id) {
      setOpen(false);
      navigate(`/projects/${n.project_id}`);
    }
  }

  async function markAll() {
    try {
      await api.post("/me/notifications/read-all");
      setItems((list) => list.map((x) => ({ ...x, read: true })));
    } catch (err) {
      push(err.message, "error");
    }
  }

  return (
    <div className="notif" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className="notif-btn"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="bell" size={16} />
        <span className="notif-label">Notifications</span>
        {unread > 0 && <span className="notif-count" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
      </button>

      {open && pos && (
        <div className="notif-panel" role="dialog" aria-label="Notifications" style={pos}>
          <div className="notif-head">
            <h2>Notifications</h2>
            <button type="button" className="btn btn-sm btn-ghost" onClick={markAll} disabled={unread === 0}>
              Mark all read
            </button>
          </div>
          {items.length === 0 ? (
            <p className="notif-empty">Nothing yet. Mentions, role changes, freezes, imports and suggestion reviews appear here.</p>
          ) : (
            <ul className="notif-list">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" className={`notif-item${n.read ? "" : " is-unread"}`} onClick={() => markRead(n)}>
                    <span className="notif-item-top">
                      <span className="notif-type">{TYPE_LABEL[n.type] || n.type}</span>
                      <span className="text-muted">{timeAgo(n.created_at)}</span>
                    </span>
                    <span className="notif-msg">{n.message}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
