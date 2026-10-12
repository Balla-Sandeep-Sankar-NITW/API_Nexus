import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { computeLayeredLayout } from "../utils/layout";
import GraphCanvas from "./GraphCanvas";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

const NO_HIGHLIGHT = new Set();
const STEP_MS = 1600;

// Replays how the architecture changed: every saved snapshot in order, then the
// live graph as the last step. Drag the slider or press Play. Changes are matched
// by name, so restoring a snapshot (which re-creates nodes) doesn't look like
// everything was replaced.
export default function TimeTravelPanel({ projectId, graph }) {
  const [snapshots, setSnapshots] = useState(null);
  const [index, setIndex] = useState(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    api.get(`/projects/${projectId}/timeline`).then(setSnapshots).catch(() => setSnapshots([]));
  }, [projectId]);

  const frames = useMemo(() => {
    if (!snapshots) return [];
    return [
      ...snapshots,
      { id: "now", label: "Now (live graph)", created_at: new Date().toISOString(), nodes: graph.nodes, edges: graph.edges },
    ];
  }, [snapshots, graph]);

  const current = index === null ? frames.length - 1 : Math.min(index, frames.length - 1);

  // Playback stops by itself at the last step.
  const isPlaying = playing && current < frames.length - 1;
  useEffect(() => {
    if (!isPlaying) return;
    const t = setTimeout(() => setIndex(current + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [isPlaying, current]);

  const frame = frames[current];

  // Nodes that were never arranged sit at 0,0; lay the frame out locally.
  const drawn = useMemo(() => {
    if (!frame) return null;
    if (!frame.nodes.some((n) => n.pos_x === 0 && n.pos_y === 0)) return frame;
    const layout = computeLayeredLayout(frame.nodes, frame.edges);
    return { ...frame, nodes: frame.nodes.map((n) => (layout[n.id] ? { ...n, pos_x: layout[n.id].x, pos_y: layout[n.id].y } : n)) };
  }, [frame]);

  const change = useMemo(() => {
    if (!frame || current === 0) return null;
    const prev = frames[current - 1];
    const names = (f) => new Map(f.nodes.map((n) => [n.id, n.label]));
    const edgeKeys = (f) => {
      const label = names(f);
      return new Set(f.edges.map((e) => `${label.get(e.source_node_id)} > ${label.get(e.target_node_id)}`));
    };
    const prevNodes = new Set(prev.nodes.map((n) => n.label));
    const nowNodes = new Set(frame.nodes.map((n) => n.label));
    const prevEdges = edgeKeys(prev);
    const nowEdges = edgeKeys(frame);
    return {
      added: [...nowNodes].filter((l) => !prevNodes.has(l)).sort(),
      removed: [...prevNodes].filter((l) => !nowNodes.has(l)).sort(),
      linksAdded: [...nowEdges].filter((k) => !prevEdges.has(k)).length,
      linksRemoved: [...prevEdges].filter((k) => !nowEdges.has(k)).length,
      from: prev.label,
    };
  }, [frames, frame, current]);

  if (snapshots === null) return <LoadingRow>Loading history…</LoadingRow>;

  if (snapshots.length === 0) {
    return (
      <EmptyState title="No history to replay yet">
        Time travel replays your saved snapshots. Open the Versions tab and save a snapshot now, then save another after your next change.
      </EmptyState>
    );
  }

  function go(i) {
    setPlaying(false);
    setIndex(i);
  }

  function togglePlay() {
    if (isPlaying) return setPlaying(false);
    if (current >= frames.length - 1) setIndex(0);
    setPlaying(true);
  }

  return (
    <>
      <div className="tt-controls">
        <button type="button" className="btn btn-primary btn-sm" onClick={togglePlay}>
          {isPlaying ? "Pause" : current >= frames.length - 1 ? "Replay" : "Play"}
        </button>
        <button type="button" className="btn btn-sm" onClick={() => go(current - 1)} disabled={current === 0}>Back</button>
        <button type="button" className="btn btn-sm" onClick={() => go(current + 1)} disabled={current >= frames.length - 1}>Next</button>
        <input
          type="range"
          className="tt-slider"
          min={0}
          max={frames.length - 1}
          step={1}
          value={current}
          onChange={(e) => go(Number(e.target.value))}
          aria-label="Point in time"
          aria-valuetext={`${frame.label}, step ${current + 1} of ${frames.length}`}
        />
      </div>

      <div className="tt-caption" aria-live="polite">
        <strong>{frame.label}</strong>
        <span className="text-muted">
          Step {current + 1} of {frames.length}
          {frame.id !== "now" && ` · saved ${new Date(frame.created_at).toLocaleString()}`}
        </span>
      </div>

      <div className="tt-stage">
        <GraphCanvas
          nodes={drawn.nodes}
          allNodes={drawn.nodes}
          edges={drawn.edges}
          selectedId={null}
          onSelect={() => {}}
          highlightedIds={NO_HIGHLIGHT}
          animateChain={null}
          layoutVersion={current}
        />
      </div>

      <div className="diff" aria-live="polite">
        <div className="diff-group">
          <h3>{change ? `Changes since "${change.from}"` : "Starting point"}</h3>
          <p className="field-hint" style={{ margin: 0 }}>
            {frame.nodes.length} nodes, {frame.edges.length} links.
            {change && ` ${change.linksAdded} link${change.linksAdded === 1 ? "" : "s"} added, ${change.linksRemoved} removed.`}
            {change && change.added.length === 0 && change.removed.length === 0 && " No nodes were added or removed."}
          </p>
        </div>
        {change && change.added.length > 0 && (
          <div className="diff-group">
            <h3>Nodes added ({change.added.length})</h3>
            <ul className="diff-list diff-added">
              {change.added.slice(0, 15).map((n) => (
                <li key={n}><span className="diff-sign" aria-hidden="true">+</span><span>{n}</span></li>
              ))}
              {change.added.length > 15 && <li className="text-muted">and {change.added.length - 15} more</li>}
            </ul>
          </div>
        )}
        {change && change.removed.length > 0 && (
          <div className="diff-group">
            <h3>Nodes removed ({change.removed.length})</h3>
            <ul className="diff-list diff-removed">
              {change.removed.slice(0, 15).map((n) => (
                <li key={n}><span className="diff-sign" aria-hidden="true">−</span><span>{n}</span></li>
              ))}
              {change.removed.length > 15 && <li className="text-muted">and {change.removed.length - 15} more</li>}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
