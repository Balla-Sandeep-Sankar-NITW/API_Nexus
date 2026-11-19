import { useCallback, useEffect, useRef, useState } from "react";
import { panelId, tabId } from "./tabIds";

// Accessible tab list (roving tabindex, arrow/Home/End keys). The parent
// renders the panel and should give it role="tabpanel" and
// aria-labelledby={tabId(prefix, id)}.

export default function Tabs({ tabs, value, onChange, prefix, label }) {
  const refs = useRef({});
  const listRef = useRef(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  // Fade the edges that have more tabs hidden behind them, so a scrolling strip looks scrollable.
  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    setEdge({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = listRef.current;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro?.disconnect(); window.removeEventListener("resize", measure); };
  }, [measure]);

  // Keep the selected tab visible (matters when a link opens straight on a later tab).
  useEffect(() => {
    const el = listRef.current;
    const active = refs.current[value];
    if (!el || !active) return;
    const target = active.offsetLeft - (el.clientWidth - active.offsetWidth) / 2;
    el.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
  }, [value]);

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
    <div className={`tabs-wrap${edge.left ? " has-left" : ""}${edge.right ? " has-right" : ""}`}>
    <div className="tabs" role="tablist" aria-label={label} onKeyDown={onKeyDown} ref={listRef} onScroll={measure}>
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
    </div>
  );
}
