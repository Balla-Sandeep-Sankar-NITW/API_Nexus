import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Menu from "./ui/Menu";
import Logomark from "./ui/Logomark";
import ProfileModal from "./ProfileModal";
import { initials } from "../utils/initials";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const inProjects = useLocation().pathname.startsWith("/projects");
  const [showProfile, setShowProfile] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-brand" aria-label="API Nexus home">
          <Logomark />
          <span>
            <span className="sidebar-brand-name">API Nexus</span>
            <span className="sidebar-brand-tag">Dependency &amp; impact mapping</span>
          </span>
        </NavLink>
        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => (isActive || inProjects ? "active" : "")}>
            Projects
          </NavLink>
        </nav>

        {/* Desktop: account block at the bottom of the sidebar */}
        <div className="sidebar-footer">
          <button type="button" className="sidebar-user" onClick={() => setShowProfile(true)}>
            <span className="avatar" aria-hidden="true">{initials(user?.full_name)}</span>
            <span className="sidebar-user-text">
              <span className="sidebar-user-name truncate">{user?.full_name}</span>
              <span className="sidebar-user-email truncate" title={user?.email}>{user?.email}</span>
            </span>
          </button>
          <button type="button" className="btn btn-sm btn-block" onClick={handleLogout}>
            Log out
          </button>
        </div>

        {/* Mobile: the same account block collapses into an avatar menu */}
        <div className="account-menu">
          <Menu
            label={<span className="avatar">{initials(user?.full_name)}</span>}
            ariaLabel="Account menu"
            buttonClassName="avatar-btn"
            chevron={false}
            items={[
              { label: "Profile settings", onSelect: () => setShowProfile(true) },
              { label: "Log out", onSelect: handleLogout },
            ]}
          />
        </div>
      </aside>
      <main className="main-area">
        <Outlet />
      </main>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
