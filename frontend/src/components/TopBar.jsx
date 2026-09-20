import NotificationBell from "./NotificationBell";

/**
 * Every page renders its own topbar through this component instead of a
 * raw .topbar div, so the notification bell is laid out in the same flex
 * row as page-specific right-side content (like a role badge) rather than
 * floating over it as an absolutely-positioned overlay. That overlay
 * approach previously caused the bell to visually collide with the
 * leader/member/viewer badge on the project page.
 */
export default function TopBar({ breadcrumb, right }) {
  return (
    <div className="topbar">
      <div className="breadcrumb">{breadcrumb}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        {right}
        <NotificationBell />
      </div>
    </div>
  );
}
