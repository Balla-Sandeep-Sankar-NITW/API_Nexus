import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import ProfileModal from "./ProfileModal";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showProfile, setShowProfile] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          API Nexus
          <small>Dependency &amp; impact mapping</small>
        </div>
        <nav className="sidebar-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Projects
          </NavLink>
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={() => setShowProfile(true)}
            style={{ all: "unset", cursor: "pointer", display: "block", width: "100%", marginBottom: 10 }}
          >
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{user?.full_name}</div>
            <div style={{ fontSize: 12, color: "var(--ink-500)" }}>{user?.email}</div>
            {!user?.is_verified && (
              <span className="badge badge-amber" style={{ marginTop: 6 }}>
                <span className="badge-dot" />Unverified
              </span>
            )}
          </button>
          <button className="btn btn-sm" style={{ width: "100%" }} onClick={handleLogout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="main-area">
        <Outlet />
      </div>
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
