import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { computeLayeredLayout } from "../utils/layout";
import GraphCanvas from "../components/GraphCanvas";
import NodeDetailPanel from "../components/NodeDetailPanel";
import ImportOpenApiModal from "../components/ImportOpenApiModal";
import AddNodeModal from "../components/AddNodeModal";
import AddEdgeModal from "../components/AddEdgeModal";
import MembersPanel from "../components/MembersPanel";
import AuditLogPanel from "../components/AuditLogPanel";
import InsightsPanel from "../components/InsightsPanel";
import VersionsPanel from "../components/VersionsPanel";
import PathExplorerModal from "../components/PathExplorerModal";
import ConfirmDialog from "../components/ConfirmDialog";
import Icon from "../components/ui/Icon";
import Menu from "../components/ui/Menu";
import Tabs from "../components/ui/Tabs";
import { panelId, tabId } from "../components/ui/tabIds";
import Monogram from "../components/ui/Monogram";
import EmptyState from "../components/ui/EmptyState";
import LoadingRow from "../components/ui/LoadingRow";
import { exportGraphJson, exportDependencyCsv } from "../utils/export";

const NODE_TYPE_FILTERS = [
  { id: "api", label: "API" },
  { id: "schema", label: "Schema" },
  { id: "auth", label: "Auth" },
  { id: "service", label: "Service" },
  { id: "database", label: "Database" },
  { id: "external", label: "External" },
  { id: "custom", label: "Custom" },
];

const TABS = [
  { id: "graph", label: "Graph" },
  { id: "insights", label: "Insights" },
  { id: "versions", label: "Versions" },
  { id: "members", label: "Members" },
  { id: "activity", label: "Activity" },
];

export default function ProjectGraph() {
  const { projectId } = useParams();
  const { push } = useToast();

  const [project, setProject] = useState(null);
  const [graph, setGraph] = useState(null);
  const [tab, setTab] = useState("graph");
  const [selectedId, setSelectedId] = useState(null);
  const [highlighted, setHighlighted] = useState(new Set());
  const [animateChain, setAnimateChain] = useState(null);
  const [typeFilter, setTypeFilter] = useState(new Set());
  const [search, setSearch] = useState("");
  const [layoutVersion, setLayoutVersion] = useState(0);

  const [showImport, setShowImport] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [showPathExplorer, setShowPathExplorer] = useState(false);
  const [showArrangeConfirm, setShowArrangeConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const laidOutRef = useRef(false);
  const searchRef = useRef(null);

  function loadProject() {
    api.get(`/projects/${projectId}`).then(setProject).catch((err) => push(err.message, "error"));
  }
  function loadGraph() {
    laidOutRef.current = false;
    api.get(`/projects/${projectId}/graph`).then(setGraph).catch((err) => push(err.message, "error"));
  }

  useEffect(() => {
    loadProject();
    loadGraph();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // One-time auto-layout for a freshly imported / never-arranged graph.
  // Runs once per load; afterwards every node has a real pos_x/pos_y so
  // GraphCanvas never needs to recompute layout on its own.
  useEffect(() => {
    if (!graph || laidOutRef.current) return;
    laidOutRef.current = true;
    const needsLayout = graph.nodes.some((n) => n.pos_x === 0 && n.pos_y === 0);
    if (!needsLayout || graph.nodes.length === 0) return;
    applyLayout(graph);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  // Compute a layout for the whole graph, store it locally, and persist it
  // with the same PATCH used when a node is dragged.
  function applyLayout(g) {
    const computed = computeLayeredLayout(g.nodes, g.edges);
    const updatedNodes = g.nodes.map((n) => {
      const p = computed[n.id];
      return p ? { ...n, pos_x: p.x, pos_y: p.y } : n;
    });
    setGraph((prev) => ({ ...prev, nodes: updatedNodes }));
    setLayoutVersion((v) => v + 1);
    return Promise.allSettled(
      updatedNodes.map((n) => api.patch(`/projects/${projectId}/nodes/${n.id}`, { pos_x: n.pos_x, pos_y: n.pos_y }))
    );
  }

  async function handleArrange() {
    setShowArrangeConfirm(false);
    const results = await applyLayout(graph);
    const failed = results.filter((r) => r.status === "rejected").length;
    if (failed > 0) push(`Rearranged, but ${failed} position${failed === 1 ? "" : "s"} could not be saved`, "error");
    else push("Nodes rearranged", "success");
  }

  // "/" focuses the node search from anywhere on the graph tab.
  useEffect(() => {
    if (tab !== "graph") return;
    function onKeyDown(e) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && t.closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      searchRef.current?.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [tab]);

  // On narrow screens the detail panel sits below the canvas: bring it into view
  // when a node is picked, and let "Back to graph" return to the canvas.
  useEffect(() => {
    if (!selectedId || !window.matchMedia("(max-width: 960px)").matches) return;
    document.querySelector(".graph-detail-panel")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [selectedId]);

  function backToGraph() {
    setSelectedId(null);
    document.querySelector(".graph-workspace")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const myRole = project?.my_role;
  const canEdit = myRole === "leader" || myRole === "member";

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    const q = search.trim().toLowerCase();
    return graph.nodes.filter((n) => {
      if (typeFilter.size > 0 && !typeFilter.has(n.node_type)) return false;
      if (q && !n.label.toLowerCase().includes(q) && !(n.path || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [graph, typeFilter, search]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => filteredNodeIds.has(e.source_node_id) && filteredNodeIds.has(e.target_node_id)) : []),
    [graph, filteredNodeIds]
  );

  const typeCounts = useMemo(() => {
    const counts = {};
    (graph?.nodes || []).forEach((n) => (counts[n.node_type] = (counts[n.node_type] || 0) + 1));
    return counts;
  }, [graph]);

  const selectedNode = graph?.nodes.find((n) => n.id === selectedId) || null;
  const filtersActive = typeFilter.size > 0 || search.trim() !== "";

  function toggleTypeFilter(type) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  function clearFilters() {
    setTypeFilter(new Set());
    setSearch("");
  }

  async function handlePositionCommit(nodeId, x, y) {
    setGraph((g) => ({ ...g, nodes: g.nodes.map((n) => (n.id === nodeId ? { ...n, pos_x: x, pos_y: y } : n)) }));
    try {
      await api.patch(`/projects/${projectId}/nodes/${nodeId}`, { pos_x: x, pos_y: y });
    } catch (err) {
      push(err.message, "error");
    }
  }

  function handleNodeCreated(node) {
    setGraph((g) => ({ ...g, nodes: [...g.nodes, node] }));
    loadProject();
  }

  function handleEdgeCreated(edge) {
    setGraph((g) => ({ ...g, edges: [...g.edges, edge] }));
    loadProject();
  }

  function handleImported() {
    loadGraph();
    loadProject();
  }

  function handleNodeMutated() {
    loadGraph();
  }

  async function handleDeleteNode() {
    try {
      await api.del(`/projects/${projectId}/nodes/${deleteTarget.id}`);
      push(`${deleteTarget.label} deleted`, "success");
      setSelectedId(null);
      setDeleteTarget(null);
      loadGraph();
      loadProject();
    } catch (err) {
      push(err.message, "error");
    }
  }

  if (!project || !graph) {
    return <LoadingRow>Loading project…</LoadingRow>;
  }

  const addItems = [
    { label: "Add node", onSelect: () => setShowAddNode(true) },
    { label: "Add link", onSelect: () => setShowAddEdge(true) },
  ];
  const exportItems = [
    { label: "Graph as JSON", onSelect: () => exportGraphJson(project, graph) },
    { label: "Dependencies as CSV", onSelect: () => exportDependencyCsv(project, graph) },
  ];

  return (
    <>
      <div className="topbar">
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Projects</Link>
          <span aria-hidden="true">/</span>
          <span className="current" aria-current="page">{project.name}</span>
        </nav>
        <span className={`role-chip role-${myRole}`} title="Your role in this project">{myRole}</span>
      </div>

      <div className="project-page">
        <header className="project-header">
          <div className="project-header-row">
            <Monogram name={project.name} />
            <div className="project-header-text">
              <h1>{project.name}</h1>
              {project.description && <p>{project.description}</p>}
            </div>
          </div>
          <Tabs tabs={TABS} value={tab} onChange={setTab} prefix="project" label="Project sections" />
        </header>

        <div
          className={tab === "graph" ? "tab-panel tab-panel--graph" : "tab-panel"}
          role="tabpanel"
          id={panelId("project", tab)}
          aria-labelledby={tabId("project", tab)}
        >
          {tab === "graph" && (
            <>
              <div className="toolbar">
                <div className="search">
                  <Icon name="search" size={14} />
                  <input
                    ref={searchRef}
                    type="search"
                    placeholder="Search nodes"
                    aria-label="Search nodes"
                    aria-keyshortcuts="/"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                  <kbd className="kbd" aria-hidden="true">/</kbd>
                </div>
                <div className="toolbar-group" role="group" aria-label="Filter by node type">
                  {NODE_TYPE_FILTERS.filter((t) => typeCounts[t.id]).map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="chip"
                      aria-pressed={typeFilter.has(t.id)}
                      onClick={() => toggleTypeFilter(t.id)}
                    >
                      <span className="chip-swatch" style={{ background: `var(--type-${t.id})` }} aria-hidden="true" />
                      {t.label}
                      <span className="chip-count">{typeCounts[t.id]}</span>
                    </button>
                  ))}
                  {filtersActive && (
                    <button type="button" className="btn btn-sm btn-ghost" onClick={clearFilters}>
                      Clear
                    </button>
                  )}
                </div>
                <div className="toolbar-spacer" />
                <div className="toolbar-group">
                  {graph.nodes.length >= 2 && (
                    <button type="button" className="btn btn-sm" onClick={() => setShowPathExplorer(true)}>
                      Path explorer
                    </button>
                  )}
                  <Menu label="Export" items={exportItems} />
                  {myRole === "leader" && (
                    <button type="button" className="btn btn-sm" onClick={() => setShowImport(true)}>
                      Import OpenAPI
                    </button>
                  )}
                  {canEdit && <Menu label="Add" items={addItems} />}
                </div>
              </div>

              {graph.nodes.length === 0 ? (
                <EmptyState
                  title="This graph is empty"
                  action={
                    myRole === "leader" && (
                      <button type="button" className="btn btn-primary" onClick={() => setShowImport(true)}>
                        Import OpenAPI spec
                      </button>
                    )
                  }
                >
                  {myRole === "leader"
                    ? "Import an OpenAPI spec to generate the dependency graph, or add nodes manually."
                    : "Ask a project leader to import an OpenAPI spec to get started."}
                </EmptyState>
              ) : (
                <div className="graph-workspace">
                  <GraphCanvas
                    nodes={filteredNodes}
                    allNodes={graph.nodes}
                    edges={filteredEdges}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onPositionCommit={handlePositionCommit}
                    highlightedIds={highlighted}
                    animateChain={animateChain}
                    layoutVersion={layoutVersion}
                    onArrange={canEdit ? () => setShowArrangeConfirm(true) : undefined}
                    filtersActive={filtersActive}
                    onClearFilters={clearFilters}
                  />
                  <div className="graph-detail-panel">
                    <NodeDetailPanel
                      project={project}
                      node={selectedNode}
                      myRole={myRole}
                      onFocusChain={setAnimateChain}
                      onHighlight={setHighlighted}
                      onNodeMutated={handleNodeMutated}
                      onDeleteNode={setDeleteTarget}
                      onBack={backToGraph}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {tab !== "graph" && (
            <div className="tab-panel-inner">
              {tab === "insights" && <InsightsPanel graph={graph} />}
              {tab === "versions" && <VersionsPanel projectId={projectId} />}
              {tab === "members" && <MembersPanel projectId={projectId} myRole={myRole} />}
              {tab === "activity" && <AuditLogPanel projectId={projectId} />}
            </div>
          )}
        </div>
      </div>

      {showImport && (
        <ImportOpenApiModal projectId={projectId} onClose={() => setShowImport(false)} onImported={handleImported} />
      )}
      {showAddNode && (
        <AddNodeModal projectId={projectId} onClose={() => setShowAddNode(false)} onCreated={handleNodeCreated} />
      )}
      {showAddEdge && (
        <AddEdgeModal projectId={projectId} nodes={graph.nodes} onClose={() => setShowAddEdge(false)} onCreated={handleEdgeCreated} />
      )}
      {showPathExplorer && (
        <PathExplorerModal
          projectId={projectId}
          nodes={graph.nodes}
          onClose={() => setShowPathExplorer(false)}
          onFocusChain={setAnimateChain}
        />
      )}
      {showArrangeConfirm && (
        <ConfirmDialog
          title="Auto-arrange nodes"
          message="This replaces every node's current position, including ones you placed by hand, and saves the new layout for everyone on this project."
          confirmLabel="Auto-arrange"
          onConfirm={handleArrange}
          onCancel={() => setShowArrangeConfirm(false)}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete node"
          message={`Delete "${deleteTarget.label}"? Its dependency links will also be removed. This cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDeleteNode}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}
