import { useEffect, useId, useRef, useState } from "react";
import Icon from "./Icon";

// Small dropdown menu. Keyboard: Enter/Space/ArrowDown opens, arrows move,
// Escape closes and returns focus to the trigger.
export default function Menu({ label, items, buttonClassName = "btn btn-sm", align = "right", chevron = true, ariaLabel }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector("button:not(:disabled)")?.focus();
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus();
  }

  function onListKeyDown(e) {
    const buttons = Array.from(listRef.current.querySelectorAll("button:not(:disabled)"));
    const i = buttons.indexOf(document.activeElement);
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[(i + 1) % buttons.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons[(i - 1 + buttons.length) % buttons.length]?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div className="menu" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={buttonClassName}
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        {chevron && <Icon name="chevron-down" size={14} />}
      </button>
      {open && (
        <div
          id={menuId}
          ref={listRef}
          role="menu"
          className="menu-list"
          style={align === "left" ? { left: 0, right: "auto" } : undefined}
          onKeyDown={onListKeyDown}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="menu-item"
              disabled={item.disabled}
              onClick={() => {
                close(false);
                item.onSelect();
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
