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

export function exportGraphSvg(svgElement, project) {
  const serializer = new XMLSerializer();
  const source = serializer.serializeToString(svgElement);
  downloadBlob(source, `${slug(project.name)}-graph.svg`, "image/svg+xml");
}

function slug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";
}
