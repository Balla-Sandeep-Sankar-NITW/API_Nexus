import { useEffect, useRef } from "react";

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    function handleEscape(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="panel"
      style={{
        position: "fixed",
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 180,
        padding: 4,
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} style={{ borderTop: "1px solid var(--line)", margin: "4px 0" }} />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.onClick();
              onClose();
            }}
            disabled={item.disabled}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "7px 10px",
              fontSize: 13,
              background: "none",
              border: "none",
              borderRadius: "var(--radius-sm)",
              cursor: item.disabled ? "not-allowed" : "pointer",
              opacity: item.disabled ? 0.45 : 1,
              color: item.danger ? "var(--status-red)" : "var(--ink-900)",
            }}
            onMouseEnter={(e) => !item.disabled && (e.currentTarget.style.background = "var(--surface-1)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  );
}
