import { useEffect, useMemo, useRef, useState, useCallback, forwardRef, useImperativeHandle } from "react";
import { computeForceLayout } from "../utils/layout";

const TYPE_COLOR = {
  api: "#3b82f6",
  schema: "#a855f7",
  auth: "#f59e0b",
  service: "#10b981",
  database: "#06b6d4",
  external: "#64748b",
  custom: "#8b5cf6",
};

const METHOD_STYLES = {
  GET: { bg: "rgba(16, 185, 129, 0.25)", text: "#34d399", border: "rgba(16, 185, 129, 0.5)" },
  POST: { bg: "rgba(59, 130, 246, 0.25)", text: "#60a5fa", border: "rgba(59, 130, 246, 0.5)" },
  PUT: { bg: "rgba(245, 158, 11, 0.25)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.5)" },
  PATCH: { bg: "rgba(245, 158, 11, 0.25)", text: "#fbbf24", border: "rgba(245, 158, 11, 0.5)" },
  DELETE: { bg: "rgba(239, 68, 68, 0.25)", text: "#f87171", border: "rgba(239, 68, 68, 0.5)" },
  DEFAULT: { bg: "rgba(168, 85, 247, 0.25)", text: "#c084fc", border: "rgba(168, 85, 247, 0.5)" },
};

const FREEZE_STROKE = {
  frozen: "#ef4444",
  impacted: "#f59e0b",
  selected: "#818cf8",
  active: "#334155",
};

const NODE_W = 200;
const NODE_H = 54;

const GraphCanvas = forwardRef(function GraphCanvas({
  nodes,
  edges,
  selectedId,
  onSelect,
  onPositionCommit,
  highlightedIds,
  animateChain,
  onNodeContextMenu,
}, ref) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [size, setSize] = useState({ width: 1000, height: 700 });
  const [positions, setPositions] = useState({});
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 0.8 });
  const [dragging, setDragging] = useState(null);
  const [panning, setPanning] = useState(null);
  const [pulseTick, setPulseTick] = useState(0);
  const layoutCalculated = useRef(false);

  const handleAutoLayout = useCallback(() => {
    if (!nodes || nodes.length === 0) return;
    const computed = computeForceLayout(nodes, edges, { width: size.width || 1200, height: size.height || 800 });
    setPositions(computed);
    if (onPositionCommit) {
      Object.entries(computed).forEach(([id, pos]) => {
        onPositionCommit(id, Math.round(pos.x), Math.round(pos.y));
      });
    }
  }, [nodes, edges, size, onPositionCommit]);

  useImperativeHandle(ref, () => ({
    getSvgElement: () => svgRef.current,
    relayout: handleAutoLayout,
  }));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) {
        setSize({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Force-calculate layout on initial node load if nodes are overlapping/clumped
  useEffect(() => {
    if (!nodes || nodes.length === 0) return;

    // Run auto-layout automatically if it hasn't run yet or if positions are near zero
    if (!layoutCalculated.current) {
      const computed = computeForceLayout(nodes, edges, { width: size.width || 1200, height: size.height || 800 });
      setPositions(computed);
      layoutCalculated.current = true;
    }
  }, [nodes, edges, size]);

  useEffect(() => {
    if (!animateChain || animateChain.length === 0) return;
    const interval = setInterval(() => setPulseTick((t) => t + 1), 900);
    return () => clearInterval(interval);
  }, [animateChain]);

  function screenToWorld(clientX, clientY) {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left - transform.x) / transform.k,
      y: (clientY - rect.top - transform.y) / transform.k,
    };
  }

  const handleNodeMouseDown = useCallback(
    (e, node) => {
      e.stopPropagation();
      const world = screenToWorld(e.clientX, e.clientY);
      const pos = positions[node.id] || { x: 0, y: 0 };
      setDragging({ id: node.id, offsetX: world.x - pos.x, offsetY: world.y - pos.y, moved: false });
      onSelect(node.id);
    },
    [positions, transform, onSelect]
  );

  function handleMouseMove(e) {
    if (dragging) {
      const world = screenToWorld(e.clientX, e.clientY);
      setPositions((prev) => ({
        ...prev,
        [dragging.id]: { x: world.x - dragging.offsetX, y: world.y - dragging.offsetY },
      }));
      setDragging((d) => ({ ...d, moved: true }));
    } else if (panning) {
      setTransform((t) => ({
        ...t,
        x: panning.startTx + (e.clientX - panning.startX),
        y: panning.startTy + (e.clientY - panning.startY),
      }));
    }
  }

  function handleMouseUp() {
    if (dragging && dragging.moved && onPositionCommit) {
      const pos = positions[dragging.id];
      if (pos) {
        onPositionCommit(dragging.id, Math.round(pos.x), Math.round(pos.y));
      }
    }
    setDragging(null);
    setPanning(null);
  }

  function handleBackgroundMouseDown(e) {
    setPanning({ startX: e.clientX, startY: e.clientY, startTx: transform.x, startTy: transform.y });
    onSelect(null);
  }

  function handleWheel(e) {
    e.preventDefault();
    const delta = -e.deltaY * 0.001;
    setTransform((t) => {
      const newK = Math.min(2.5, Math.max(0.15, t.k + delta));
      return { ...t, k: newK };
    });
  }

  function zoomBy(factor) {
    setTransform((t) => ({ ...t, k: Math.min(2.5, Math.max(0.15, t.k * factor)) }));
  }

  function resetView() {
    setTransform({ x: 0, y: 0, k: 0.8 });
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

  const dim = (id) => {
    if (highlightedIds && highlightedIds.size > 0) return !highlightedIds.has(id);
    if (connectedIds) return !connectedIds.has(id);
    return false;
  };

  // Ensure active/selected nodes render on top of unselected nodes
  const sortedNodes = useMemo(() => {
    return [...nodes].sort((a, b) => {
      if (a.id === selectedId || a.id === dragging?.id) return 1;
      if (b.id === selectedId || b.id === dragging?.id) return -1;
      return 0;
    });
  }, [nodes, selectedId, dragging]);

  return (
    <div
      className="graph-canvas-wrap"
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onMouseDown={handleBackgroundMouseDown}
      onWheel={handleWheel}
      style={{
        cursor: panning ? "grabbing" : "grab",
        background: "#0d1117",
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div className="graph-toolbar" onMouseDown={(e) => e.stopPropagation()}>
        <button className="btn btn-sm" onClick={() => zoomBy(1.2)} title="Zoom in">+</button>
        <button className="btn btn-sm" onClick={() => zoomBy(0.8)} title="Zoom out">−</button>
        <button className="btn btn-sm" onClick={resetView} title="Reset view">Reset</button>
        <button className="btn btn-sm btn-accent" onClick={handleAutoLayout} title="Auto arrange all nodes">Auto Layout</button>
      </div>

      <svg width="100%" height="100%" ref={svgRef}>
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#475569" />
          </marker>
        </defs>

        <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
          {/* Edges */}
          {edges.map((e) => {
            const a = positions[e.source_node_id];
            const b = positions[e.target_node_id];
            if (!a || !b) return null;
            const faded = dim(e.source_node_id) || dim(e.target_node_id);
            const isChainEdge =
              animateChain &&
              animateChain.length > 1 &&
              animateChain.some(
                (id, i) =>
                  i < animateChain.length - 1 &&
                  ((animateChain[i] === e.source_node_id && animateChain[i + 1] === e.target_node_id) ||
                    (animateChain[i] === e.target_node_id && animateChain[i + 1] === e.source_node_id))
              );

            return (
              <g key={e.id} opacity={faded ? 0.35 : 1}>
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isChainEdge ? "#ef4444" : "#334155"}
                  strokeWidth={isChainEdge ? 2.5 : 1.5}
                  strokeDasharray={isChainEdge ? "6 4" : undefined}
                  style={
                    isChainEdge
                      ? { strokeDashoffset: -pulseTick * 4, transition: "stroke-dashoffset 0.4s linear" }
                      : undefined
                  }
                  markerEnd="url(#arrow)"
                />
              </g>
            );
          })}

          {/* Nodes */}
          {sortedNodes.map((node) => {
            const pos = positions[node.id];
            if (!pos) return null;

            const isSelected = node.id === selectedId;
            const faded = dim(node.id);

            const methodKey = (node.method || "").toUpperCase();
            const methodStyle = METHOD_STYLES[methodKey] || METHOD_STYLES.DEFAULT;
            const typeColor = TYPE_COLOR[node.node_type] || "#64748b";

            let strokeColor = FREEZE_STROKE.active;
            if (node.freeze_status === "frozen") strokeColor = FREEZE_STROKE.frozen;
            else if (node.freeze_status === "impacted") strokeColor = FREEZE_STROKE.impacted;
            else if (isSelected) strokeColor = FREEZE_STROKE.selected;

            const strokeWidth = isSelected ? 2.5 : node.freeze_status !== "active" ? 2 : 1;
            const methodText = node.method ? node.method.toUpperCase() : node.node_type.toUpperCase();

            return (
              <g
                key={node.id}
                transform={`translate(${pos.x - NODE_W / 2},${pos.y - NODE_H / 2})`}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onContextMenu={(e) => {
                  if (onNodeContextMenu) {
                    e.preventDefault();
                    onSelect(node.id);
                    onNodeContextMenu(e, node);
                  }
                }}
                style={{ cursor: "pointer" }}
                opacity={faded ? 0.7 : 1}
              >
                {/* Card Background */}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={8}
                  fill={isSelected ? "#26334d" : "#1e293b"}
                  stroke={strokeColor}
                  strokeWidth={strokeWidth}
                />

                {/* Left Type Accent Bar */}
                <rect width={5} height={NODE_H} rx={2} fill={typeColor} />

                {/* Method / Type Pill */}
                <g transform="translate(14, 8)">
                  <rect
                    width={methodText.length * 6.8 + 10}
                    height={16}
                    rx={4}
                    fill={methodStyle.bg}
                    stroke={methodStyle.border}
                    strokeWidth="0.8"
                  />
                  <text
                    x={5}
                    y={12}
                    fontSize="9.5"
                    fontFamily="Inter, system-ui, sans-serif"
                    fontWeight="700"
                    fill={methodStyle.text}
                    style={{ pointerEvents: "none" }}
                  >
                    {methodText}
                  </text>
                </g>

                {/* Endpoint Path / Label */}
                <text
                  x={14}
                  y={40}
                  fontSize="12.5"
                  fontFamily="Inter, system-ui, sans-serif"
                  fontWeight="600"
                  fill="#ffffff"
                  style={{ pointerEvents: "none" }}
                >
                  {truncate(node.path || node.label, 22)}
                </text>

                {/* Freeze / Impact Indicator Dot */}
                {node.freeze_status === "frozen" && (
                  <circle cx={NODE_W - 12} cy={12} r={4} fill="#ef4444" />
                )}
                {node.freeze_status === "impacted" && (
                  <circle cx={NODE_W - 12} cy={12} r={4} fill="#f59e0b" />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      {/* Graph Legend */}
      <div className="graph-legend">
        <div className="graph-legend-row">
          <span className="badge-dot" style={{ background: "#334155" }} /> Active
        </div>
        <div className="graph-legend-row">
          <span className="badge-dot" style={{ background: "#f59e0b" }} /> Impacted
        </div>
        <div className="graph-legend-row">
          <span className="badge-dot" style={{ background: "#ef4444" }} /> Frozen
        </div>
        <div className="graph-legend-row">
          <span className="badge-dot" style={{ background: "#818cf8" }} /> Selected
        </div>
      </div>
    </div>
  );
});

export default GraphCanvas;

function truncate(str, n) {
  if (!str) return "";
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}