import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [loadError, setLoadError] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();

  function load() {
    api
      .get("/me/notifications")
      .then((data) => {
        setNotifications(data);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    try {
      await api.post("/me/notifications/read-all", {});
      load();
    } catch {
      /* ignore */
    }
  }

  async function handleClickNotification(n) {
    if (!n.read) {
      try {
        await api.post(`/me/notifications/${n.id}/read`, {});
        setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    if (n.project_id) navigate(`/projects/${n.project_id}`);
  }

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen((o) => !o)} aria-label="Notifications">
        Notifications{unreadCount > 0 ? ` (${unreadCount})` : ""}
      </button>
      {open && (
        <div
          className="panel"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            width: 340,
            maxHeight: 420,
            overflowY: "auto",
            zIndex: 50,
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
          }}
        >
          <div className="panel-header">
            <h2 style={{ margin: 0 }}>Notifications</h2>
            {unreadCount > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={markAllRead}>Mark all read</button>
            )}
          </div>
          {loadError ? (
            <div className="detail-empty">Couldn't load notifications — check that the backend is reachable and try again.</div>
          ) : notifications.length === 0 ? (
            <div className="detail-empty">
              Nothing yet. Notifications appear here when a teammate mentions you, invites you, changes your role,
              or freezes something — not for actions you take yourself.
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                onClick={() => handleClickNotification(n)}
                style={{
                  padding: "10px 16px",
                  borderBottom: "1px solid var(--line)",
                  cursor: "pointer",
                  background: n.read ? "transparent" : "var(--accent-tint)",
                }}
              >
                <div style={{ fontSize: 12.5 }}>{n.message}</div>
                <div style={{ fontSize: 11, color: "var(--ink-300)", marginTop: 2 }}>
                  {new Date(n.created_at).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
