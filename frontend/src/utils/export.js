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

export function openPrintableReport(project, graph, findings) {
  const win = window.open("", "_blank");
  if (!win) return;

  const nodesByType = {};
  graph.nodes.forEach((n) => {
    nodesByType[n.node_type] = (nodesByType[n.node_type] || 0) + 1;
  });

  const findingsHtml = (findings?.findings || [])
    .map(
      (f) => `
      <div style="padding:10px 0;border-bottom:1px solid #dde1e6;">
        <div style="display:flex;justify-content:space-between;">
          <strong>${escapeHtml(f.title)}</strong>
          <span style="text-transform:uppercase;font-size:11px;color:#626b79;">${f.severity}</span>
        </div>
        <p style="font-size:12.5px;color:#333a45;margin:4px 0;">${escapeHtml(f.description)}</p>
        <p style="font-size:12px;color:#626b79;margin:0;"><em>Suggested action:</em> ${escapeHtml(f.remediation)}</p>
      </div>`
    )
    .join("");

  win.document.write(`
    <html>
      <head>
        <title>${escapeHtml(project.name)} — API Nexus report</title>
        <style>
          body { font-family: -apple-system, Inter, sans-serif; color: #14181f; max-width: 720px; margin: 40px auto; padding: 0 20px; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          .meta { color: #626b79; font-size: 13px; margin-bottom: 24px; }
          .stat-row { display: flex; gap: 24px; margin-bottom: 24px; }
          .stat { border: 1px solid #dde1e6; border-radius: 6px; padding: 12px 16px; }
          .stat .n { font-size: 22px; font-weight: 600; }
          .stat .l { font-size: 12px; color: #626b79; }
          h2 { font-size: 15px; margin-top: 32px; border-bottom: 1px solid #dde1e6; padding-bottom: 6px; }
          @media print { body { margin: 0; } }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(project.name)}</h1>
        <div class="meta">${escapeHtml(project.description || "")} — generated ${new Date().toLocaleString()}</div>
        <div class="stat-row">
          <div class="stat"><div class="n">${graph.nodes.length}</div><div class="l">Nodes</div></div>
          <div class="stat"><div class="n">${graph.edges.length}</div><div class="l">Dependency links</div></div>
          <div class="stat"><div class="n">${findings?.high_count ?? 0}</div><div class="l">High-severity findings</div></div>
        </div>
        <h2>Node breakdown</h2>
        ${Object.entries(nodesByType).map(([t, c]) => `<div style="font-size:13px;padding:3px 0;">${t}: <strong>${c}</strong></div>`).join("")}
        <h2>Findings</h2>
        ${findingsHtml || '<p style="font-size:13px;color:#626b79;">No findings.</p>'}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

export function exportGraphSvg(svgElement, project) {
  if (!svgElement) return;
  const serializer = new XMLSerializer();
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("style", "background:#ffffff");
  const source = serializer.serializeToString(clone);
  downloadBlob(source, `${slug(project.name)}-graph.svg`, "image/svg+xml");
}

export function exportGraphPng(svgElement, project) {
  if (!svgElement) return;
  const rect = svgElement.getBoundingClientRect();
  const width = Math.max(800, Math.round(rect.width) || 1200);
  const height = Math.max(600, Math.round(rect.height) || 800);

  const serializer = new XMLSerializer();
  const clone = svgElement.cloneNode(true);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", width);
  clone.setAttribute("height", height);
  const source = serializer.serializeToString(clone);
  const svgBlob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement("canvas");
    canvas.width = width * 2; // 2x for a sharper export
    canvas.height = height * 2;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0, width, height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (blob) downloadBlob(blob, `${slug(project.name)}-graph.png`, "image/png");
    }, "image/png");
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
}

function slug(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";
}
