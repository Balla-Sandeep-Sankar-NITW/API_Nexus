import { downloadBlob } from "./export";

const esc = (v) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const slug = (name) => name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "project";

const table = (head, rows) =>
  rows.length === 0
    ? ""
    : `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows
        .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
        .join("")}</tbody></table>`;

function sunsetText(d) {
  if (!d.sunset_date) return "No date";
  if (d.days_left < 0) return `${d.sunset_date} (${-d.days_left} days ago)`;
  return `${d.sunset_date} (in ${d.days_left} days)`;
}

const STATUS_TEXT = { overdue: "Overdue", in_use: "Still in use", safe_to_remove: "Safe to remove" };

// One self-contained HTML file: open it in a browser, or print it to PDF.
// All the numbers come from the same endpoints as the app's own screens.
export function exportReportHtml(project, { graph, risk, security, findings, deprecations }) {
  const generated = new Date().toLocaleString();
  const topRisk = risk.nodes.filter((n) => n.score > 0).slice(0, 10);
  const unowned = risk.nodes.filter((n) => n.factors.some((f) => f.label === "No owner")).slice(0, 15);
  const exposed = security.sensitive_schemas.filter((s) => s.exposed_endpoints.length > 0);
  const overdue = deprecations.filter((d) => d.status === "overdue").length;

  const stats = [
    ["Nodes", graph.nodes.length],
    ["Dependency links", graph.edges.length],
    ["Endpoints with auth", security.endpoints_total ? `${security.coverage_percent}%` : "n/a"],
    ["Critical or high risk", risk.critical_count + risk.high_count],
    ["High-severity findings", findings.high_count],
    ["Overdue deprecations", overdue],
    ["Nodes with an owner", `${risk.owned_count} of ${risk.total_nodes}`],
  ];

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(project.name)}: dependency report</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { color-scheme: light; }
  body { font: 14px/1.5 -apple-system, "Segoe UI", Roboto, sans-serif; color: #0f1b2d; margin: 0; background: #f3f6fb; }
  main { max-width: 920px; margin: 0 auto; padding: 32px 24px 64px; background: #fff; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  h2 { font-size: 18px; margin: 36px 0 8px; padding-top: 12px; border-top: 1px solid #dde5f0; }
  p { margin: 6px 0; } .muted { color: #526078; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin: 20px 0 0; }
  .stat { border: 1px solid #dde5f0; border-radius: 6px; padding: 10px 12px; }
  .stat b { display: block; font-size: 22px; } .stat span { color: #526078; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 13px; }
  th, td { text-align: left; padding: 7px 8px; border-bottom: 1px solid #dde5f0; vertical-align: top; }
  th { color: #526078; font-weight: 600; }
  .tag { display: inline-block; padding: 1px 8px; border-radius: 99px; font-size: 12px; font-weight: 600; }
  .critical, .high-sev, .overdue { background: #fdeaea; color: #b42323; }
  .high, .medium-sev, .in_use { background: #fdf0d9; color: #8a5300; }
  .medium, .low-sev { background: #e8eef7; color: #3d4f6e; }
  .low, .safe_to_remove { background: #e3f6ec; color: #0f7a4f; }
  code { font-family: ui-monospace, Consolas, monospace; font-size: 12px; }
  .note { font-size: 12px; color: #526078; margin-top: 40px; border-top: 1px solid #dde5f0; padding-top: 12px; }
  @media print { body { background: #fff; } main { padding: 0; } h2 { break-after: avoid; } tr { break-inside: avoid; } }
</style></head><body><main>
<h1>${esc(project.name)}</h1>
<p class="muted">Dependency and risk report · generated ${esc(generated)}</p>
${project.description ? `<p>${esc(project.description)}</p>` : ""}
<div class="stats">${stats.map(([l, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>

<h2>Highest risk</h2>
<p class="muted">Score is 0 to 100, from blast radius, dependency depth, missing authentication, missing owners and deprecation.</p>
${topRisk.length === 0 ? "<p>No node carries any risk.</p>" : table(
  ["Node", "Score", "Why", "Depended on by"],
  topRisk.map((n) => [
    esc(n.label),
    `<span class="tag ${n.level}">${n.score} ${esc(n.level)}</span>`,
    esc(n.factors.map((f) => f.label).join(", ")),
    `${n.dependents_total}`,
  ])
)}

<h2>Security</h2>
${security.endpoints_total === 0 ? "<p>No API endpoints in this graph.</p>" : `
<p>${security.endpoints_protected} of ${security.endpoints_total} endpoints require authentication (${security.coverage_percent}%).</p>
${security.unprotected.length ? `<p><b>Endpoints without authentication</b></p>${table(["Endpoint"], security.unprotected.map((e) => [`<code>${esc(e.label)}</code>`]))}` : ""}
${exposed.length ? `<p><b>Sensitive-looking schemas reachable without authentication</b> (matched by name)</p>${table(
  ["Schema", "Looks like", "Unprotected endpoints"],
  exposed.map((s) => [esc(s.label), esc(s.category), s.exposed_endpoints.map((e) => `<code>${esc(e.label)}</code>`).join("<br>")])
)}` : "<p>No sensitive-looking schema is reachable without authentication.</p>"}`}

<h2>Findings</h2>
${findings.findings.length === 0 ? "<p>No findings.</p>" : table(
  ["Severity", "Finding", "What to do"],
  findings.findings.map((f) => [`<span class="tag ${f.severity}-sev">${esc(f.severity)}</span>`, `<b>${esc(f.title)}</b><br>${esc(f.description)}`, esc(f.remediation)])
)}

<h2>Deprecations</h2>
${deprecations.length === 0 ? "<p>Nothing is marked deprecated.</p>" : table(
  ["Node", "Status", "Sunset", "Still used by", "Owner"],
  deprecations.map((d) => [
    esc(d.label),
    `<span class="tag ${d.status}">${esc(STATUS_TEXT[d.status])}</span>`,
    esc(sunsetText(d)),
    d.total_dependents ? esc(d.direct_dependents.map((x) => x.label).join(", ")) : "Nothing",
    esc([d.owner_team, d.owner_contact].filter(Boolean).join(", ") || "Unassigned"),
  ])
)}

<h2>Ownership gaps</h2>
${unowned.length === 0 ? "<p>Every node that something depends on has an owner.</p>" : `<p class="muted">Other components depend on these, but no team or contact is assigned.</p>${table(
  ["Node", "Depended on by"], unowned.map((n) => [esc(n.label), `${n.dependents_total} component${n.dependents_total === 1 ? "" : "s"}`])
)}`}

<p class="note">Generated by API Nexus. Risk scores, findings and sensitive-schema detection are heuristics read from the dependency graph, and are a starting point for review, not a security audit.</p>
</main></body></html>`;

  downloadBlob(html, `${slug(project.name)}-report.html`, "text/html");
}
