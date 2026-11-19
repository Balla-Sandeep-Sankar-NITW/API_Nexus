import { useEffect, useRef, useState } from "react";

// Thin bar under the top edge that moves while any request is in flight. It waits 250ms
// before appearing, so quick requests never flash it.
export default function TopProgress() {
  const [state, setState] = useState("idle"); // idle | running | finishing
  const [pct, setPct] = useState(0);
  const timers = useRef([]);

  useEffect(() => {
    const clear = () => { timers.current.forEach(clearTimeout); timers.current = []; };
    const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

    function onBusy(e) {
      const n = e.detail;
      if (n > 0) {
        if (state !== "idle" || timers.current.length) return;
        later(() => { setState("running"); setPct(18); }, 250);
        later(() => setPct(46), 650);
        later(() => setPct(70), 1600);
        later(() => setPct(84), 4000);
      } else {
        clear();
        setState((s) => {
          if (s === "idle") return s;
          setPct(100);
          later(() => { setState("idle"); setPct(0); }, 260);
          return "finishing";
        });
      }
    }
    window.addEventListener("api:busy", onBusy);
    return () => { window.removeEventListener("api:busy", onBusy); clear(); };
  }, [state]);

  return (
    <div className={`top-progress is-${state}`} aria-hidden="true">
      <div className="top-progress-bar" style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}
