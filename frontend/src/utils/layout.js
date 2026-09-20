/**
 * Compact Force-Directed Layout Generator
 */

const CARD_WIDTH = 205;
const CARD_HEIGHT = 60;

export function computeForceLayout(nodes, edges, { width = 1000, height = 700, iterations = 260 } = {}) {
  if (!nodes || nodes.length === 0) return {};

  const count = nodes.length;
  const positions = {};

  // 1. Grid-based Initial Spawn (compact aspect ratio)
  const cols = Math.ceil(Math.sqrt(count * 1.3));
  const spacingX = 210;
  const spacingY = 90;
  const startX = (width - cols * spacingX) / 2 + spacingX / 2;
  const startY = (height - (count / cols) * spacingY) / 2 + spacingY / 2;

  nodes.forEach((n, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions[n.id] = {
      x: startX + col * spacingX + (Math.random() - 0.5) * 15,
      y: startY + row * spacingY + (Math.random() - 0.5) * 15,
    };
  });

  const nodeIds = nodes.map((n) => n.id);

  // Tuned parameters for compact grouping
  const repulsionStrength = 85000;  // Reduced to stop pushing nodes far apart
  const springLength = 170;          // Tightened from 320 to 170
  const springStrength = 0.035;
  const centerStrength = 0.015;      // Stronger centering pull

  let temperature = 1.0;
  const coolingRate = 1 / iterations;

  for (let iter = 0; iter < iterations; iter++) {
    const forces = {};
    nodeIds.forEach((id) => (forces[id] = { x: 0, y: 0 }));

    // 2. Repulsion & Collision Prevention
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const a = nodeIds[i];
        const b = nodeIds[j];

        const dx = positions[a].x - positions[b].x;
        const dy = positions[a].y - positions[b].y;

        // Mild horizontal scaling (1.2 instead of 2.2) to prevent wide blowout
        const scaledDx = dx / 1.25;
        const distSq = Math.max(scaledDx * scaledDx + dy * dy, 100);
        const dist = Math.sqrt(distSq);

        let force = repulsionStrength / distSq;

        // Active overlap prevention
        const absX = Math.abs(dx);
        const absY = Math.abs(dy);
        if (absX < CARD_WIDTH && absY < CARD_HEIGHT) {
          const overlapX = CARD_WIDTH - absX;
          const overlapY = CARD_HEIGHT - absY;
          force += (overlapX + overlapY) * 10;
        }

        const fx = (dx / (dist || 1)) * force;
        const fy = (dy / (dist || 1)) * force;

        forces[a].x += fx;
        forces[a].y += fy;
        forces[b].x -= fx;
        forces[b].y -= fy;
      }
    }

    // 3. Link Spring Attraction
    edges.forEach((e) => {
      const a = positions[e.source_node_id];
      const b = positions[e.target_node_id];
      if (!a || !b) return;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const displacement = dist - springLength;

      const fx = (dx / dist) * displacement * springStrength;
      const fy = (dy / dist) * displacement * springStrength;

      forces[e.source_node_id].x += fx;
      forces[e.source_node_id].y += fy;
      forces[e.target_node_id].x -= fx;
      forces[e.target_node_id].y -= fy;
    });

    // 4. Inward Centering Gravity
    const centerX = width / 2;
    const centerY = height / 2;
    nodeIds.forEach((id) => {
      forces[id].x += (centerX - positions[id].x) * centerStrength;
      forces[id].y += (centerY - positions[id].y) * centerStrength;
    });

    // 5. Update positions with step damping
    const maxStep = 35 * temperature;
    nodeIds.forEach((id) => {
      const fx = Math.max(-maxStep, Math.min(maxStep, forces[id].x * 0.035));
      const fy = Math.max(-maxStep, Math.min(maxStep, forces[id].y * 0.035));
      positions[id].x += fx;
      positions[id].y += fy;
    });

    temperature -= coolingRate;
  }

  return positions;
}