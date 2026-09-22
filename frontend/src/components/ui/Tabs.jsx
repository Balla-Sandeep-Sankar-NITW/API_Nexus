import { useRef } from "react";
import { panelId, tabId } from "./tabIds";

// Accessible tab list (roving tabindex, arrow/Home/End keys). The parent
// renders the panel and should give it role="tabpanel" and
// aria-labelledby={tabId(prefix, id)}.

export default function Tabs({ tabs, value, onChange, prefix, label }) {
  const refs = useRef({});

  function onKeyDown(e) {
    const i = tabs.findIndex((t) => t.id === value);
    let next = null;
    if (e.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
    else if (e.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
    else if (e.key === "Home") next = tabs[0];
    else if (e.key === "End") next = tabs[tabs.length - 1];
    if (next) {
      e.preventDefault();
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  }

  return (
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown}>
      {tabs.map((t) => (
        <button
          key={t.id}
          ref={(el) => (refs.current[t.id] = el)}
          id={tabId(prefix, t.id)}
          type="button"
          role="tab"
          className="tab"
          aria-selected={value === t.id}
          aria-controls={panelId(prefix, t.id)}
          tabIndex={value === t.id ? 0 : -1}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
