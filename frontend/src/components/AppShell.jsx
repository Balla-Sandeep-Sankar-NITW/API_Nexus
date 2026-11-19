import { useState } from "react";
import { Suspense } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { PageSkeleton } from "./ui/Skeleton";
import { useAuth } from "../context/AuthContext";
import Menu from "./ui/Menu";
import Logomark from "./ui/Logomark";
import Icon from "./ui/Icon";
import ProfileModal from "./ProfileModal";
import NotificationBell from "./NotificationBell";
import { initials } from "../utils/initials";

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const inProjects = pathname.startsWith("/projects");
  // One fade per page change (not per tab or filter), keyed on the first two path segments.
  const routeKey = pathname.split("/").slice(0, 3).join("/");
  const [showProfile, setShowProfile] = useState(false);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <NavLink to="/" className="sidebar-brand" aria-label="API Nexus home">
          <Logomark size={36} />
          <span>
            <span className="sidebar-brand-name">API Nexus</span>
            <span className="sidebar-brand-tag">Dependency &amp; impact mapping</span>
          </span>
        </NavLink>
        <nav className="sidebar-nav" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => (isActive || inProjects ? "active" : "")}>
            <Icon name="folder" size={18} />
            <span>Projects</span>
          </NavLink>
          <NotificationBell />
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
          <button type="button" className="btn btn-block sidebar-logout" onClick={handleLogout}>
            Log out
          </button>
          <nav className="sidebar-links" aria-label="More">
            <Link to="/help">Help</Link>
            <Link to="/about">About</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </nav>
          <p className="sidebar-free">Free and open to everyone</p>
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
        <div className="route-fade" key={routeKey}>
          <Suspense fallback={<PageSkeleton />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </div>
  );
}
