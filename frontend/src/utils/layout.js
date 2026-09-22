// Layered (left-to-right) graph layout.
//
// Edges point from a node to the thing it depends on (source depends on
// target), so nodes nothing depends on land in the first column and their
// dependencies flow to the right. Tall layers wrap into several balanced
// columns, and ordering is refined with a few barycenter sweeps so nodes that
// share dependencies end up next to each other.
//
// The result is deterministic and, by construction, has no overlapping nodes.
// Returned positions are node centers: { [id]: { x, y } }.

export const NODE_W = 184;
export const NODE_H = 44;

const TYPE_RANK = { api: 0, auth: 1, service: 2, database: 3, external: 4, schema: 5, custom: 6 };

export function computeLayeredLayout(nodes, edges, opts = {}) {
  if (nodes.length === 0) return {};

  const gapY = opts.gapY ?? 14;
  const gapCol = opts.gapCol ?? 28; // between wrapped columns of one layer
  const gapLayer = opts.gapLayer ?? 72; // between layers
  const margin = opts.margin ?? 80;
  const targetAspect = opts.targetAspect ?? 1.5; // width / height of the finished layout

  const ids = new Set(nodes.map((n) => n.id));
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const out = {}; // id -> targets (dependencies)
  const inc = {}; // id -> sources (dependents)
  nodes.forEach((n) => {
    out[n.id] = [];
    inc[n.id] = [];
  });
  const seen = new Set();
  edges.forEach((e) => {
    const { source_node_id: s, target_node_id: t } = e;
    if (s === t || !ids.has(s) || !ids.has(t)) return;
    const key = `${s}>${t}`;
    if (seen.has(key)) return;
    seen.add(key);
    out[s].push(t);
    inc[t].push(s);
  });

  // 1. Layer = longest path from a root (Kahn's algorithm; nodes caught in a
  //    cycle are placed one layer past their deepest resolved dependent).
  const layer = {};
  const indeg = {};
  nodes.forEach((n) => (indeg[n.id] = inc[n.id].length));
  let queue = nodes.filter((n) => indeg[n.id] === 0).map((n) => n.id);
  queue.forEach((id) => (layer[id] = 0));
  const done = new Set();
  while (queue.length) {
    const next = [];
    for (const id of queue) {
      done.add(id);
      for (const t of out[id]) {
        layer[t] = Math.max(layer[t] ?? 0, layer[id] + 1);
        if (--indeg[t] === 0) next.push(t);
      }
    }
    queue = next;
  }
  nodes.forEach((n) => {
    if (done.has(n.id)) return;
    const resolved = inc[n.id].filter((s) => layer[s] !== undefined).map((s) => layer[s] + 1);
    layer[n.id] = resolved.length ? Math.max(...resolved) : 0;
  });

  // Unconnected nodes get their own layer at the end so they don't clutter the flow.
  const isolated = nodes.filter((n) => out[n.id].length === 0 && inc[n.id].length === 0);
  const isolatedIds = new Set(isolated.map((n) => n.id));
  const connected = nodes.filter((n) => !isolatedIds.has(n.id));
  const layerCount = connected.length ? Math.max(...connected.map((n) => layer[n.id])) + 1 : 0;
  isolated.forEach((n) => (layer[n.id] = layerCount));

  const layers = [];
  nodes.forEach((n) => {
    (layers[layer[n.id]] ||= []).push(n.id);
  });
  for (let i = 0; i < layers.length; i++) layers[i] ||= [];

  // 2. Initial order: type, then path/label, so related endpoints start together.
  const sortKey = (id) => {
    const n = byId[id];
    return [TYPE_RANK[n.node_type] ?? 9, (n.path || n.label || "").toLowerCase(), n.method || ""];
  };
  const cmp = (a, b) => {
    const ka = sortKey(a);
    const kb = sortKey(b);
    return ka[0] - kb[0] || ka[1].localeCompare(kb[1]) || ka[2].localeCompare(kb[2]);
  };
  layers.forEach((l) => l.sort(cmp));

  // 3. Barycenter sweeps (forward on dependents, backward on dependencies).
  const order = {};
  const reindex = () =>
    layers.forEach((l) => l.forEach((id, i) => (order[id] = l.length > 1 ? i / (l.length - 1) : 0.5)));
  reindex();
  const bary = (id, neighbors) => {
    const ns = neighbors[id];
    if (!ns.length) return order[id];
    return ns.reduce((sum, n) => sum + order[n], 0) / ns.length;
  };
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 1; i < layers.length; i++) {
      if (i === layerCount) continue; // isolated layer keeps alphabetical order
      const scores = Object.fromEntries(layers[i].map((id) => [id, bary(id, inc)]));
      layers[i].sort((a, b) => scores[a] - scores[b] || cmp(a, b));
      reindex();
    }
    for (let i = layers.length - 2; i >= 0; i--) {
      if (i === layerCount) continue;
      const scores = Object.fromEntries(layers[i].map((id) => [id, bary(id, out)]));
      layers[i].sort((a, b) => scores[a] - scores[b] || cmp(a, b));
      reindex();
    }
  }

  // 4. Choose how tall a column may get so the whole layout is roughly as wide
  //    as it is tall (times targetAspect); a 60-node layer becomes 3 columns
  //    rather than one very tall strip.
  const rowStep = NODE_H + gapY;
  const nonEmpty = layers.filter((l) => l.length > 0);
  const measure = (cap) => {
    let cols = 0;
    let rows = 1;
    nonEmpty.forEach((l) => {
      const c = Math.ceil(l.length / cap);
      cols += c;
      rows = Math.max(rows, Math.ceil(l.length / c));
    });
    const width = cols * (NODE_W + gapCol) + (nonEmpty.length - 1) * (gapLayer - gapCol);
    return { width, height: rows * rowStep };
  };
  let maxPerColumn = opts.maxPerColumn;
  if (!maxPerColumn) {
    const longest = Math.max(1, ...nonEmpty.map((l) => l.length));
    let best = Infinity;
    for (let cap = 6; cap <= Math.max(6, longest); cap++) {
      const { width, height } = measure(cap);
      const score = Math.abs(Math.log(width / height / targetAspect));
      if (score < best - 1e-9) {
        best = score;
        maxPerColumn = cap;
      }
    }
  }

  // 5. Place: wrap tall layers into balanced columns, center columns vertically.
  const positions = {};
  const tallest = Math.max(1, ...layers.map((l) => Math.min(maxPerColumn, l.length)));
  let cursorX = margin;
  layers.forEach((l) => {
    if (l.length === 0) return;
    const cols = Math.ceil(l.length / maxPerColumn);
    const per = Math.ceil(l.length / cols);
    for (let c = 0; c < cols; c++) {
      const slice = l.slice(c * per, (c + 1) * per);
      const yOffset = ((tallest - slice.length) * rowStep) / 2;
      slice.forEach((id, r) => {
        positions[id] = {
          x: Math.round(cursorX + NODE_W / 2),
          y: Math.round(margin + yOffset + r * rowStep + NODE_H / 2),
        };
      });
      cursorX += NODE_W + (c === cols - 1 ? gapLayer : gapCol);
    }
  });

  return positions;
}
