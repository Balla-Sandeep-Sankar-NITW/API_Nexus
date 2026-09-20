import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import { computeForceLayout } from "../utils/layout";
import TopBar from "../components/TopBar";
import GraphCanvas from "../components/GraphCanvas";
import NodeDetailPanel from "../components/NodeDetailPanel";
import ImportOpenApiModal from "../components/ImportOpenApiModal";
import AddNodeModal from "../components/AddNodeModal";
import AddEdgeModal from "../components/AddEdgeModal";
import EdgeManagerModal from "../components/EdgeManagerModal";
import MembersPanel from "../components/MembersPanel";
import AuditLogPanel from "../components/AuditLogPanel";
import InsightsPanel from "../components/InsightsPanel";
import VersionsPanel from "../components/VersionsPanel";
import FindingsPanel from "../components/FindingsPanel";
import SnapshotsPanel from "../components/SnapshotsPanel";
import ShareLinkModal from "../components/ShareLinkModal";
import PathExplorerModal from "../components/PathExplorerModal";
import ConfirmDialog from "../components/ConfirmDialog";
import ContextMenu from "../components/ContextMenu";
import { exportGraphJson, exportDependencyCsv, exportGraphSvg, exportGraphPng, openPrintableReport } from "../utils/export";

const NODE_TYPE_FILTERS = ["api", "schema", "auth", "service", "database", "external", "custom"];

export default function ProjectGraph() {
  const { projectId } = useParams();
  const { push } = useToast();

  const [project, setProject] = useState(null);
  const [graph, setGraph] = useState(null);
  const [members, setMembers] = useState([]);
  const [tab, setTab] = useState("graph");
  const [selectedId, setSelectedId] = useState(null);
  const [highlighted, setHighlighted] = useState(new Set());
  const [animateChain, setAnimateChain] = useState(null);
  const [typeFilter, setTypeFilter] = useState(new Set());
  const [search, setSearch] = useState("");
  const [renamingProject, setRenamingProject] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [contextMenu, setContextMenu] = useState(null);

  const [showImport, setShowImport] = useState(false);
  const [showAddNode, setShowAddNode] = useState(false);
  const [showAddEdge, setShowAddEdge] = useState(false);
  const [showEdgeManager, setShowEdgeManager] = useState(false);
  const [showPathExplorer, setShowPathExplorer] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const laidOutRef = useRef(false);
  const canvasRef = useRef(null);

  function loadProject() {
    api.get(`/projects/${projectId}`).then(setProject).catch((err) => push(err.message, "error"));
  }
  function loadGraph() {
    laidOutRef.current = false;
    api.get(`/projects/${projectId}/graph`).then(setGraph).catch((err) => push(err.message, "error"));
  }
  function loadMembers() {
    api.get(`/projects/${projectId}/members`).then(setMembers).catch(() => {});
  }

  useEffect(() => {
    loadProject();
    loadGraph();
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // One-time auto-layout for a freshly imported / never-arranged graph.
  useEffect(() => {
    if (!graph || laidOutRef.current) return;
    laidOutRef.current = true;
    const needsLayout = graph.nodes.some((n) => n.pos_x === 0 && n.pos_y === 0);
    if (!needsLayout || graph.nodes.length === 0) return;
    const computed = computeForceLayout(graph.nodes, graph.edges, { width: 1000, height: 640 });
    const updatedNodes = graph.nodes.map((n) => {
      const p = computed[n.id];
      return p ? { ...n, pos_x: Math.round(p.x), pos_y: Math.round(p.y) } : n;
    });
    setGraph((g) => ({ ...g, nodes: updatedNodes }));
    updatedNodes.forEach((n) => {
      api.patch(`/projects/${projectId}/nodes/${n.id}`, { pos_x: n.pos_x, pos_y: n.pos_y }).catch(() => {});
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graph]);

  const myRole = project?.my_role;
  const canEdit = myRole === "leader" || myRole === "member";
  const isLeader = myRole === "leader";

  const filteredNodes = useMemo(() => {
    if (!graph) return [];
    return graph.nodes.filter((n) => {
      if (typeFilter.size > 0 && !typeFilter.has(n.node_type)) return false;
      if (search && !n.label.toLowerCase().includes(search.toLowerCase()) && !(n.path || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [graph, typeFilter, search]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(
    () => (graph ? graph.edges.filter((e) => filteredNodeIds.has(e.source_node_id) && filteredNodeIds.has(e.target_node_id)) : []),
    [graph, filteredNodeIds]
  );

  const selectedNode = graph?.nodes.find((n) => n.id === selectedId) || null;

  function toggleTypeFilter(type) {
    setTypeFilter((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
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

  function handleEdgeUpdated(edge) {
    setGraph((g) => ({ ...g, edges: g.edges.map((e) => (e.id === edge.id ? edge : e)) }));
  }

  function handleEdgeDeleted(edgeId) {
    setGraph((g) => ({ ...g, edges: g.edges.filter((e) => e.id !== edgeId) }));
    loadProject();
  }

  function handleImported() {
    loadGraph();
    loadProject();
  }

  function handleNodeMutated() {
    loadGraph();
  }

  async function handleRenameProject(e) {
    e.preventDefault();
    try {
      const updated = await api.patch(`/projects/${projectId}`, { name: nameDraft });
      setProject((p) => ({ ...p, name: updated.name }));
      setRenamingProject(false);
      push("Project renamed", "success");
    } catch (err) {
      push(err.message, "error");
    }
  }

  const performDelete = useCallback(
    async (node) => {
      try {
        await api.del(`/projects/${projectId}/nodes/${node.id}`);
        setSelectedId((id) => (id === node.id ? null : id));
        loadGraph();
        loadProject();
        push(`${node.label} deleted`, "default", {
          action: {
            label: "Undo",
            onClick: async () => {
              try {
                const restored = await api.post(`/projects/${projectId}/nodes`, {
                  label: node.label,
                  node_type: node.node_type,
                  description: node.description,
                  method: node.method,
                  path: node.path,
                  pos_x: node.pos_x,
                  pos_y: node.pos_y,
                });
                handleNodeCreated(restored);
                push("Node restored (its links were not restored)", "success");
              } catch (err) {
                push(err.message, "error");
              }
            },
          },
        });
      } catch (err) {
        push(err.message, "error");
      }
    },
    [projectId, push]
  );

  async function handleConfirmDelete() {
    const node = deleteTarget;
    setDeleteTarget(null);
    await performDelete(node);
  }

  // Keyboard shortcuts: Delete removes the selected node, Escape clears
  // selection/closes the context menu, "/" focuses the search box.
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable) return;
      if (e.key === "Escape") {
        setContextMenu(null);
        setSelectedId(null);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selectedNode && isLeader && selectedNode.source === "manual") {
        setDeleteTarget(selectedNode);
      } else if (e.key === "/") {
        e.preventDefault();
        document.querySelector(".search-input input")?.focus();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [selectedNode, isLeader]);

  function handleNodeContextMenu(e, node) {
    const items = [
      { label: "View details", onClick: () => setSelectedId(node.id) },
      { divider: true },
      {
        label: node.freeze_status === "active" ? "Freeze" : "Unfreeze",
        onClick: async () => {
          try {
            if (node.freeze_status === "active") {
              await api.post(`/projects/${projectId}/freeze/apply`, { node_id: node.id, direction: "dependents", permanent: false });
            } else {
              await api.post(`/projects/${projectId}/freeze/unfreeze`, { node_id: node.id });
            }
            loadGraph();
          } catch (err) {
            push(err.message, "error");
          }
        },
        disabled: !canEdit,
      },
      { divider: true },
      { label: "Delete node", onClick: () => setDeleteTarget(node), disabled: !isLeader || node.source !== "manual", danger: true },
    ];
    setContextMenu({ x: e.clientX, y: e.clientY, items });
  }

  if (!project || !graph) {
    return <div className="loading-row"><span className="spinner" />Loading project…</div>;
  }

  return (
    <>
      <TopBar
        breadcrumb={
          <>
            <Link to="/">Projects</Link>
            <span>/</span>
            <span className="current">{project.name}</span>
          </>
        }
        right={<span className="role-chip" style={{ textTransform: "capitalize" }}>{myRole}</span>}
      />

      <div className="content">
        {renamingProject ? (
          <form onSubmit={handleRenameProject} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
            <input value={nameDraft} onChange={(e) => setNameDraft(e.target.value)} autoFocus style={{ fontSize: 18, fontWeight: 600, padding: "4px 8px", maxWidth: 360 }} />
            <button className="btn btn-sm btn-primary" type="submit">Save</button>
            <button className="btn btn-sm" type="button" onClick={() => setRenamingProject(false)}>Cancel</button>
          </form>
        ) : (
          <h1 onClick={() => isLeader && (setNameDraft(project.name), setRenamingProject(true))} style={isLeader ? { cursor: "pointer" } : undefined} title={isLeader ? "Click to rename" : undefined}>
            {project.name}
          </h1>
        )}
        <p className="page-subtitle">{project.description || "No description"}</p>

        <div className="tabs">
          <button className={`tab ${tab === "graph" ? "active" : ""}`} onClick={() => setTab("graph")}>Graph</button>
          <button className={`tab ${tab === "findings" ? "active" : ""}`} onClick={() => setTab("findings")}>Findings</button>
          <button className={`tab ${tab === "insights" ? "active" : ""}`} onClick={() => setTab("insights")}>Insights</button>
          <button className={`tab ${tab === "snapshots" ? "active" : ""}`} onClick={() => setTab("snapshots")}>Snapshots</button>
          <button className={`tab ${tab === "versions" ? "active" : ""}`} onClick={() => setTab("versions")}>Versions</button>
          <button className={`tab ${tab === "members" ? "active" : ""}`} onClick={() => setTab("members")}>Members</button>
          <button className={`tab ${tab === "activity" ? "active" : ""}`} onClick={() => setTab("activity")}>Activity</button>
        </div>

        {tab === "graph" && (
          <>
            <div className="toolbar">
              <div className="search-input">
                <input placeholder="Search nodes… (press /)" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              {NODE_TYPE_FILTERS.map((t) => (
                <button
                  key={t}
                  className={`btn btn-sm ${typeFilter.has(t) ? "btn-primary" : ""}`}
                  onClick={() => toggleTypeFilter(t)}
                >
                  {t}
                </button>
              ))}
              <div className="toolbar-spacer" />
              {graph.nodes.length >= 2 && (
                <button className="btn btn-sm" onClick={() => setShowPathExplorer(true)}>Path explorer</button>
              )}
              {graph.edges.length > 0 && canEdit && (
                <button className="btn btn-sm" onClick={() => setShowEdgeManager(true)}>Manage links</button>
              )}
              {isLeader && (
                <button className="btn btn-sm" onClick={() => setShowShare(true)}>Share</button>
              )}
              <ExportMenu
                onExportJson={() => exportGraphJson(project, graph)}
                onExportCsv={() => exportDependencyCsv(project, graph)}
                onExportSvg={() => exportGraphSvg(canvasRef.current?.getSvgElement(), project)}
                onExportPng={() => exportGraphPng(canvasRef.current?.getSvgElement(), project)}
                onPrintReport={async () => {
                  const findings = await api.get(`/projects/${projectId}/findings`).catch(() => null);
                  openPrintableReport(project, graph, findings);
                }}
              />
              {myRole === "leader" && (
                <button className="btn btn-sm" onClick={() => setShowImport(true)}>Import OpenAPI</button>
              )}
              {canEdit && (
                <>
                  <button className="btn btn-sm" onClick={() => setShowAddNode(true)}>Add node</button>
                  <button className="btn btn-sm" onClick={() => setShowAddEdge(true)}>Add link</button>
                </>
              )}
            </div>

            {graph.nodes.length === 0 ? (
              <div className="empty-state panel">
                <h3>This graph is empty</h3>
                <p>
                  {myRole === "leader"
                    ? "Import an OpenAPI spec to auto-generate the dependency graph, or add nodes manually."
                    : "Ask your team leader to import an OpenAPI spec to get started."}
                </p>
                {myRole === "leader" && (
                  <button className="btn btn-primary" onClick={() => setShowImport(true)}>Import OpenAPI spec</button>
                )}
              </div>
            ) : (
              <div className="graph-workspace">
                <GraphCanvas
                  ref={canvasRef}
                  nodes={filteredNodes}
                  edges={filteredEdges}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onPositionCommit={handlePositionCommit}
                  highlightedIds={highlighted}
                  animateChain={animateChain}
                  onNodeContextMenu={handleNodeContextMenu}
                />
                <div className="graph-detail-panel">
                  <NodeDetailPanel
                    project={project}
                    node={selectedNode}
                    members={members}
                    myRole={myRole}
                    onFocusChain={setAnimateChain}
                    onHighlight={setHighlighted}
                    onNodeMutated={handleNodeMutated}
                    onDeleteNode={setDeleteTarget}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {tab === "findings" && <FindingsPanel projectId={projectId} />}
        {tab === "insights" && <InsightsPanel graph={graph} />}
        {tab === "snapshots" && <SnapshotsPanel projectId={projectId} myRole={myRole} onRestored={loadGraph} />}
        {tab === "versions" && <VersionsPanel projectId={projectId} />}
        {tab === "members" && <MembersPanel projectId={projectId} myRole={myRole} />}
        {tab === "activity" && <AuditLogPanel projectId={projectId} />}
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
      {showEdgeManager && (
        <EdgeManagerModal
          projectId={projectId}
          nodes={graph.nodes}
          edges={graph.edges}
          onClose={() => setShowEdgeManager(false)}
          onUpdated={handleEdgeUpdated}
          onDeleted={handleEdgeDeleted}
        />
      )}
      {showShare && <ShareLinkModal projectId={projectId} onClose={() => setShowShare(false)} />}
      {showPathExplorer && (
        <PathExplorerModal
          projectId={projectId}
          nodes={graph.nodes}
          onClose={() => setShowPathExplorer(false)}
          onFocusChain={setAnimateChain}
        />
      )}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete node"
          message={`Delete "${deleteTarget.label}"? Its dependency links will also be removed. You can undo this right after.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      {contextMenu && (
        <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />
      )}
    </>
  );
}

function ExportMenu({ onExportJson, onExportCsv, onExportSvg, onExportPng, onPrintReport }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div style={{ position: "relative" }} ref={ref}>
      <button className="btn btn-sm" onClick={() => setOpen((o) => !o)}>Export</button>
      {open && (
        <div className="panel" style={{ position: "absolute", right: 0, top: "calc(100% + 4px)", zIndex: 30, minWidth: 160, padding: 4 }}>
          {[
            ["JSON", onExportJson],
            ["CSV (dependencies)", onExportCsv],
            ["SVG image", onExportSvg],
            ["PNG image", onExportPng],
            ["Print / save as PDF", onPrintReport],
          ].map(([label, fn]) => (
            <button
              key={label}
              onClick={() => {
                fn();
                setOpen(false);
              }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 10px", fontSize: 13, background: "none", border: "none", borderRadius: "var(--radius-sm)", cursor: "pointer" }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-1)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "none")}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
