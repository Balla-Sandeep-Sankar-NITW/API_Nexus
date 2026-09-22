import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODE_H, NODE_W } from "../utils/layout";
import Icon from "./ui/Icon";

const TYPE_COLOR = {
  api: "var(--type-api)",
  schema: "var(--type-schema)",
  auth: "var(--type-auth)",
  service: "var(--type-service)",
  database: "var(--type-database)",
  external: "var(--type-external)",
  custom: "var(--type-custom)",
};

const MIN_K = 0.1;
const MAX_K = 2.5;
const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));

// Line between two node boxes, clipped to their borders so the arrowhead
// is visible instead of hiding underneath the target node.
function edgeEnds(a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  if (dx === 0 && dy === 0) return null;
  const tx = dx ? NODE_W / 2 / Math.abs(dx) : Infinity;
  const ty = dy ? NODE_H / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  if (t >= 0.5) return null; // boxes touch or overlap: nothing sensible to draw
  const pad = 3 / Math.hypot(dx, dy);
  return {
    x1: a.x + dx * t,
    y1: a.y + dy * t,
    x2: b.x - dx * (t + pad),
    y2: b.y - dy * (t + pad),
  };
}

export default function GraphCanvas({
  nodes, // nodes to draw (already filtered)
  allNodes, // every node in the project, used to seed positions
  edges,
  selectedId,
  onSelect,
  onPositionCommit,
  highlightedIds, // Set of node ids kept at full emphasis when non-empty (impact / focus)
  animateChain, // array of node ids forming a dependency chain to emphasise
  layoutVersion = 0, // bump to re-read positions from allNodes and refit
  onArrange, // optional: shows an "Arrange" control
  filtersActive,
  onClearFilters,
}) {
  const containerRef = useRef(null);
  const didFit = useRef(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [positions, setPositions] = useState({});
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(null); // {id, offsetX, offsetY, moved}
  const [panning, setPanning] = useState(null); // {startX, startY, startTx, startTy, moved}
  const pointers = useRef(new Map()); // active pointers, for two-finger pinch
  const pinch = useRef(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Seed the position map from stored pos_x/pos_y the first time we see a node.
  // Deliberately does NOT re-run when filters change, so an in-progress or
  // already-committed drag is never reset by a search/filter change.
  useEffect(() => {
    setPositions((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const n of allNodes) {
        if (!next[n.id]) {
          next[n.id] = { x: n.pos_x || 0, y: n.pos_y || 0 };
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [allNodes]);

  // Pure: the transform that frames a set of node centers inside the canvas.
  // `readable`: on very narrow canvases, don't shrink below a legible zoom;
  // frame the top-left of the graph instead and let the user pan.
  const computeFit = useCallback((pts, sz, readable = false) => {
    if (pts.length === 0 || sz.width === 0 || sz.height === 0) return null;
    const minX = Math.min(...pts.map((p) => p.x)) - NODE_W / 2;
    const maxX = Math.max(...pts.map((p) => p.x)) + NODE_W / 2;
    const minY = Math.min(...pts.map((p) => p.y)) - NODE_H / 2;
    const maxY = Math.max(...pts.map((p) => p.y)) + NODE_H / 2;
    const pad = 56;
    const w = maxX - minX;
    const h = maxY - minY;
    const k = clampK(Math.min((sz.width - pad * 2) / w, (sz.height - pad * 2) / h, 1));
    const floor = 0.34;
    if (readable && sz.width < 600 && k < floor) {
      return { k: floor, x: 16 - minX * floor, y: 64 - minY * floor };
    }
    return { k, x: (sz.width - w * k) / 2 - minX * k, y: (sz.height - h * k) / 2 - minY * k };
  }, []);

  const fitView = useCallback((readable = false) => {
    const t = computeFit(nodes.map((n) => positions[n.id]).filter(Boolean), size, readable === true);
    if (t) setTransform(t);
    return !!t;
  }, [nodes, positions, size, computeFit]);

  // Re-read every position (after an auto-arrange / first layout) and refit.
  // The fit is computed from the fresh positions directly, not from state,
  // because state has not updated yet when this effect runs.
  useEffect(() => {
    if (layoutVersion === 0) return;
    const fresh = Object.fromEntries(allNodes.map((n) => [n.id, { x: n.pos_x || 0, y: n.pos_y || 0 }]));
    setPositions(fresh);
    const t = computeFit(nodes.map((n) => fresh[n.id]).filter(Boolean), size, true);
    if (t) setTransform(t);
    didFit.current = !!t;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutVersion]);

  // Fit once when the graph first has everything it needs.
  useEffect(() => {
    if (didFit.current) return;
    if (nodes.length === 0 || !nodes.every((n) => positions[n.id])) return;
    if (fitView(true)) didFit.current = true;
  }, [nodes, positions, fitView]);

  // Wheel zoom anchored at the cursor. Attached natively because React's
  // onWheel is passive and cannot preventDefault (the page would scroll).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setTransform((t) => {
        const k = clampK(t.k * Math.exp(-e.deltaY * 0.0015));
        const r = k / t.k;
        return { k, x: mx - (mx - t.x) * r, y: my - (my - t.y) * r };
      });
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function zoomBy(factor) {
    setTransform((t) => {
      const k = clampK(t.k * factor);
      const r = k / t.k;
      const cx = size.width / 2;
      const cy = size.height / 2;
      return { k, x: cx - (cx - t.x) * r, y: cy - (cy - t.y) * r };
    });
  }

  function screenToWorld(clientX, clientY) {
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.k,
      y: (clientY - rect.top - transform.y) / transform.k,
    };
  }

  function trackPointerDown(e) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y) || 1,
        k: transform.k,
        tx: transform.x,
        ty: transform.y,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
      };
      setDragging(null);
      setPanning(null);
    }
  }

  function handleNodePointerDown(e, node) {
    if (e.button !== 0) return;
    e.stopPropagation();
    containerRef.current.setPointerCapture(e.pointerId);
    trackPointerDown(e);
    if (pinch.current) return;
    const world = screenToWorld(e.clientX, e.clientY);
    const pos = positions[node.id] || { x: 0, y: 0 };
    setDragging({ id: node.id, offsetX: world.x - pos.x, offsetY: world.y - pos.y, moved: false });
    onSelect(node.id);
  }

  function handleBackgroundPointerDown(e) {
    if (e.button !== 0) return;
    containerRef.current.setPointerCapture(e.pointerId);
    trackPointerDown(e);
    if (pinch.current) return;
    setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y, moved: false });
  }

  function handlePointerMove(e) {
    if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const p = pinch.current;
      const k = clampK(p.k * (Math.hypot(a.x - b.x, a.y - b.y) / p.dist));
      const rect = containerRef.current.getBoundingClientRect();
      // Keep the world point that started under the fingers' midpoint under them.
      const wx = (p.cx - rect.left - p.tx) / p.k;
      const wy = (p.cy - rect.top - p.ty) / p.k;
      const nx = (a.x + b.x) / 2 - rect.left;
      const ny = (a.y + b.y) / 2 - rect.top;
      setTransform({ k, x: nx - wx * k, y: ny - wy * k });
      return;
    }
    if (dragging) {
      const world = screenToWorld(e.clientX, e.clientY);
      setPositions((prev) => ({
        ...prev,
        [dragging.id]: { x: world.x - dragging.offsetX, y: world.y - dragging.offsetY },
      }));
      if (!dragging.moved) setDragging((d) => ({ ...d, moved: true }));
    } else if (panning) {
      const dx = e.clientX - panning.startX;
      const dy = e.clientY - panning.startY;
      setTransform((t) => ({ ...t, x: panning.startTx + dx, y: panning.startTy + dy }));
      if (!panning.moved && Math.hypot(dx, dy) > 3) setPanning((p) => ({ ...p, moved: true }));
    }
  }

  function handlePointerUp(e) {
    pointers.current.delete(e.pointerId);
    if (pinch.current) {
      if (pointers.current.size < 2) pinch.current = null;
      setDragging(null);
      setPanning(null);
      return;
    }
    if (dragging && dragging.moved && onPositionCommit) {
      const pos = positions[dragging.id];
      onPositionCommit(dragging.id, Math.round(pos.x), Math.round(pos.y));
    }
    // A click on empty canvas (not a pan) clears the selection.
    if (panning && !panning.moved) onSelect(null);
    setDragging(null);
    setPanning(null);
  }

  function handleKeyDown(e) {
    if (e.target instanceof HTMLElement && e.target.closest("input, textarea, select")) return;
    if (e.key === "Escape") onSelect(null);
    else if (e.key === "+" || e.key === "=") zoomBy(1.2);
    else if (e.key === "-") zoomBy(1 / 1.2);
    else if (e.key === "0") fitView();
  }

  const connectedIds = useMemo(() => {
    if (!selectedId) return null;
    const s = new Set([selectedId]);
    edges.forEach((e) => {
      if (e.source_node_id === selectedId) s.add(e.target_node_id);
      if (e.target_node_id === selectedId) s.add(e.source_node_id);
    });
    return s;
  }, [selectedId, edges]);

  const chainKeys = useMemo(() => {
    const s = new Set();
    if (animateChain && animateChain.length > 1) {
      for (let i = 0; i < animateChain.length - 1; i++) {
        s.add(`${animateChain[i]}>${animateChain[i + 1]}`);
        s.add(`${animateChain[i + 1]}>${animateChain[i]}`);
      }
    }
    return s;
  }, [animateChain]);

  const hasHighlight = highlightedIds && highlightedIds.size > 0;
  const dim = (id) => {
    if (hasHighlight) return !highlightedIds.has(id);
    if (connectedIds) return !connectedIds.has(id);
    return false;
  };

  // Edges: quiet by default, incident edges of the selection are emphasised
  // and drawn last so they sit on top.
  const drawnEdges = useMemo(() => {
    const list = [];
    for (const e of edges) {
      const a = positions[e.source_node_id];
      const b = positions[e.target_node_id];
      if (!a || !b) continue;
      const ends = edgeEnds(a, b);
      if (!ends) continue;
      const isChain = chainKeys.has(`${e.source_node_id}>${e.target_node_id}`);
      const isActive = !isChain && !!selectedId && (e.source_node_id === selectedId || e.target_node_id === selectedId);
      const faded = (hasHighlight
        ? !(highlightedIds.has(e.source_node_id) && highlightedIds.has(e.target_node_id))
        : !!connectedIds && !isActive) && !isChain;
      list.push({ id: e.id, ends, isChain, isActive, faded });
    }
    return list.sort((x, y) => Number(x.isActive || x.isChain) - Number(y.isActive || y.isChain));
  }, [edges, positions, chainKeys, selectedId, connectedIds, hasHighlight, highlightedIds]);

  return (
    <div
      className={`graph-canvas-wrap${panning ? " is-panning" : ""}`}
      ref={containerRef}
      role="group"
      aria-label="Dependency graph. Tab moves between nodes, Enter selects, plus and minus zoom, zero fits to screen, Escape clears the selection."
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onPointerDown={handleBackgroundPointerDown}
      onKeyDown={handleKeyDown}
      style={{
        backgroundSize: `${24 * transform.k}px ${24 * transform.k}px`,
        backgroundPosition: `${transform.x}px ${transform.y}px`,
        backgroundImage: transform.k < 0.4 ? "none" : undefined,
      }}
    >
      <div className="graph-controls" onPointerDown={(e) => e.stopPropagation()}>
        <button type="button" className="btn btn-icon tip" data-tip="Zoom out" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.2)}>
          <Icon name="minus" />
        </button>
        <span className="zoom-level" aria-live="off">{Math.round(transform.k * 100)}%</span>
        <button type="button" className="btn btn-icon tip" data-tip="Zoom in" aria-label="Zoom in" onClick={() => zoomBy(1.2)}>
          <Icon name="plus" />
        </button>
        <button type="button" className="btn btn-icon tip" data-tip="Fit to screen" aria-label="Fit graph to screen" onClick={() => fitView()}>
          <Icon name="fit" />
        </button>
        {onArrange && (
          <>
            <span className="divider" aria-hidden="true" />
            <button type="button" className="btn btn-icon tip" data-tip="Auto-arrange" aria-label="Auto-arrange nodes" onClick={onArrange}>
              <Icon name="arrange" />
            </button>
          </>
        )}
      </div>

      <svg className="graph-svg" role="presentation">
        <defs>
          {[
            ["arrow", ""],
            ["arrow-active", "is-active"],
            ["arrow-chain", "is-chain"],
          ].map(([id, cls]) => (
            <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" markerUnits="userSpaceOnUse" orient="auto">
              <path className={`ga ${cls}`} d="M 0 1 L 10 5 L 0 9 z" />
            </marker>
          ))}
        </defs>
        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {drawnEdges.map((e) => (
            <line
              key={e.id}
              className={`ge${e.isActive ? " is-active" : ""}${e.isChain ? " is-chain" : ""}`}
              x1={e.ends.x1}
              y1={e.ends.y1}
              x2={e.ends.x2}
              y2={e.ends.y2}
              opacity={e.faded ? 0.1 : 1}
              markerEnd={`url(#${e.isChain ? "arrow-chain" : e.isActive ? "arrow-active" : "arrow"})`}
            />
          ))}

          {nodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;
            const isSelected = node.id === selectedId;
            const frozen = node.freeze_status === "frozen";
            const impacted = node.freeze_status === "impacted";
            const isEndpoint = !!node.method;
            const text = node.path || node.label || "";
            const kicker = node.method || node.node_type;
            const state = frozen ? "Frozen" : impacted ? "Impacted" : null;
            const cls = ["gn", isSelected && "is-selected", frozen && "is-frozen", impacted && "is-impacted"]
              .filter(Boolean)
              .join(" ");
            return (
              <g
                key={node.id}
                className={cls}
                transform={`translate(${pos.x - NODE_W / 2},${pos.y - NODE_H / 2})`}
                opacity={dim(node.id) ? 0.3 : 1}
                tabIndex={0}
                role="button"
                aria-pressed={isSelected}
                aria-label={`${kicker} ${text}${state ? `, ${state}` : ""}`}
                onPointerDown={(e) => handleNodePointerDown(e, node)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(node.id);
                  }
                }}
              >
                <title>{`${kicker} ${text}${state ? ` (${state})` : ""}`}</title>
                <rect className="gn-focus" x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6} rx={6} />
                <rect className="gn-box" width={NODE_W} height={NODE_H} rx={4} />
                <rect width={4} height={NODE_H} rx={1.5} fill={TYPE_COLOR[node.node_type] || TYPE_COLOR.custom} />
                <text className={`gn-kicker${node.method ? ` method-${node.method}` : ""}`} x={14} y={17}>
                  {kicker}
                </text>
                <text className={`gn-title${isEndpoint ? " is-mono" : ""}`} x={14} y={34}>
                  {truncate(text, isEndpoint ? 22 : 25)}
                </text>
                {state && (
                  <text className={`gn-state ${state.toLowerCase()}`} x={NODE_W - 8} y={17}>
                    {state}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {nodes.length === 0 && (
        <div className="graph-empty">
          <span>No nodes match the current filters.</span>
          {filtersActive && onClearFilters && (
            <button type="button" className="btn btn-sm" onClick={onClearFilters}>Clear filters</button>
          )}
        </div>
      )}

      <div className="graph-footer" onPointerDown={(e) => e.stopPropagation()}>
        <details className="graph-legend">
          <summary>Legend</summary>
          <div className="legend-row"><span className="legend-key selected" />Selected</div>
          <div className="legend-row"><span className="legend-key impacted" />Impacted by a freeze</div>
          <div className="legend-row"><span className="legend-key frozen" />Frozen</div>
          <div className="legend-row text-muted">Arrows point to the dependency.</div>
        </details>
        <span className="graph-count">
          {nodes.length} {nodes.length === 1 ? "node" : "nodes"}, {edges.length} {edges.length === 1 ? "link" : "links"}
        </span>
      </div>
    </div>
  );
}

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}
