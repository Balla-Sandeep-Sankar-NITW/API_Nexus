function downloadBlob(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportGraphJson(project, graph) {
  const payload = {
    project: { id: project.id, name: project.name, description: project.description },
    exported_at: new Date().toISOString(),
    nodes: graph.nodes,
    edges: graph.edges,
  };
  downloadBlob(JSON.stringify(payload, null, 2), `${slug(project.name)}-graph.json`, "application/json");
}

export function exportDependencyCsv(project, graph) {
  const nodeLabel = Object.fromEntries(graph.nodes.map((n) => [n.id, n.label]));
  const rows = [["source", "target", "edge_type", "description", "origin"]];
  graph.edges.forEach((e) => {
    rows.push([
      nodeLabel[e.source_node_id] || e.source_node_id,
      nodeLabel[e.target_node_id] || e.target_node_id,
      e.edge_type,
      (e.description || "").replace(/"/g, '""'),
      e.source_origin,
    ]);
  });
  const csv = rows.map((r) => r.map((cell) => `"${cell}"`).join(",")).join("\n");
  downloadBlob(csv, `${slug(project.name)}-dependencies.csv`, "text/csv");
}

// The canvas is styled by external CSS (and CSS variables), which a standalone
// .svg file doesn't have. So copy the resolved style values onto each element,
// drop the pan/zoom transform, and frame the whole drawn graph.
const INLINE_PROPS = [
  "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "opacity",
  "fill-opacity", "stroke-opacity", "font-family", "font-size", "font-weight", "letter-spacing", "text-anchor",
];

function inlineComputedStyles(source, target) {
  const computed = getComputedStyle(source);
  INLINE_PROPS.forEach((prop) => {
    const value = computed.getPropertyValue(prop);
    if (value) target.style.setProperty(prop, value);
  });
  target.removeAttribute("tabindex");
  for (let i = 0; i < source.children.length; i++) {
    inlineComputedStyles(source.children[i], target.children[i]);
  }
}

export function exportGraphSvg(svgElement, project) {
  const content = svgElement.querySelector(":scope > g");
  if (!content) return false;
  const box = content.getBBox();
  if (box.width === 0 || box.height === 0) return false;

  const clone = svgElement.cloneNode(true);
  inlineComputedStyles(svgElement, clone);
  clone.querySelector(":scope > g").removeAttribute("transform");

  const pad = 40;
  const x = box.x - pad;
  const y = box.y - pad;
  const w = box.width + pad * 2;
  const h = box.height + pad * 2;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("viewBox", `${x} ${y} ${w} ${h}`);
  clone.setAttribute("width", String(Math.round(w)));
  clone.setAttribute("height", String(Math.round(h)));
  clone.removeAttribute("class");
  clone.removeAttribute("role");
  clone.style.cssText = "";

  const background = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  background.setAttribute("x", String(x));
  background.setAttribute("y", String(y));
  background.setAttribute("width", String(w));
  background.setAttribute("height", String(h));
  background.setAttribute("fill", "#ffffff");
  clone.insertBefore(background, clone.firstChild);

  const source = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  downloadBlob(source, `${slug(project.name)}-graph.svg`, "image/svg+xml");
  return true;
}

function slug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";
}
