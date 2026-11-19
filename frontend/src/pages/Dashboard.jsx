import { useEffect, useMemo, useRef, useState } from "react";
import ActivityFeed from "../components/ActivityFeed";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import Alert from "../components/ui/Alert";
import Monogram from "../components/ui/Monogram";
import EmptyState from "../components/ui/EmptyState";
import Icon from "../components/ui/Icon";
import { DashboardSkeleton } from "../components/ui/Skeleton";
import sampleSpec from "../utils/sampleSpec.json";

// Opening a project is the most common next step, so its code is fetched ahead of the click.
const loadProjectPage = () => import("./ProjectGraph");

// Kept for the life of the tab: coming back shows the last list instantly and refreshes behind it.
let projectsCache = null;

export default function Dashboard() {
  const [projects, setProjects] = useState(projectsCache);
  const [query, setQuery] = useState("");
  const [sampling, setSampling] = useState(false);
  const searchRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState("");
  const { push } = useToast();
  const navigate = useNavigate();

  function loadProjects() {
    api
      .get("/projects")
      .then((list) => { projectsCache = list; setProjects(list); })
      .catch((err) => { push(err.message, "error"); setProjects((cur) => cur || []); });
  }

  useEffect(() => { loadProjects(); loadProjectPage(); }, []);

  // Press "/" anywhere on the page to jump to search.
  useEffect(() => {
    function onKey(e) {
      const tag = (e.target.tagName || "").toLowerCase();
      if (e.key === "/" && !["input", "textarea", "select"].includes(tag) && !e.target.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects || [];
    if (!q) return list;
    return list.filter((p) => p.name.toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q));
  }, [projects, query]);

  async function handleSample() {
    setSampling(true);
    try {
      const project = await api.post("/projects", { name: "Sample: E-Commerce API", description: "A small example spec to explore. Safe to delete." });
      await api.post(`/projects/${project.id}/openapi/import-raw`, { raw_text: JSON.stringify(sampleSpec), format: "auto", version_label: "v1" });
      projectsCache = null;
      navigate(`/projects/${project.id}`);
    } catch (err) {
      push(err.message, "error");
      setSampling(false);
    }
  }

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const project = await api.post("/projects", { name, description });
      projectsCache = null;
      push(`Project "${project.name}" created`, "success");
      setShowCreate(false);
      setName("");
      setDescription("");
      navigate(`/projects/${project.id}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <>
      <div className="topbar topbar--dash">
        <div className="breadcrumb">
          <span className="current">Projects</span>
        </div>
      </div>
      <div className="page">
        <div className="page-inner is-narrow">
          <div className="page-head">
            <h1>Projects</h1>
            <div className="page-head-actions">
              <button
                type="button"
                className="btn"
                aria-expanded={showHistory}
                aria-controls="history-panel"
                onClick={() => setShowHistory((v) => !v)}
              >
                {showHistory ? "Hide history" : "History"}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                New project
              </button>
            </div>
          </div>

          {showHistory && (
            <section className="history-panel" id="history-panel" aria-labelledby="history-title">
              <div className="section-head">
                <h2 id="history-title">History</h2>
                <p>The latest changes across every project you belong to.</p>
              </div>
              <ActivityFeed path="/me/activity" pageSize={10} emptyTitle="Nothing has changed yet" emptyText="Changes you and your teammates make will show up here." />
            </section>
          )}

          {projects === null && <DashboardSkeleton />}

          {projects && projects.length === 0 && (
            <EmptyState
              title="No projects yet"
              action={
                <span className="empty-actions">
                  <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    Create a project
                  </button>
                  <button type="button" className={`btn${sampling ? " is-loading" : ""}`} onClick={handleSample} disabled={sampling} aria-busy={sampling}>
                    {sampling ? "Setting up…" : "Try the sample project"}
                  </button>
                </span>
              }
            >
              Create a project, then import an OpenAPI spec to generate its first dependency graph.
            </EmptyState>
          )}

          {projects && projects.length > 0 && (
            <div className="dash-top">
              <dl className="stat-chip" aria-label="Number of projects">
                <dt>Projects</dt>
                <dd>{projects.length}</dd>
              </dl>
              <div className="search-field">
                <Icon name="search" size={16} />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Search projects by name or description"
                  aria-label="Search projects"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <kbd aria-hidden="true">/</kbd>
              </div>
            </div>
          )}

          {projects && projects.length > 0 && (
            <div className="table-wrap stack">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Project</th>
                    <th scope="col" className="num">Nodes</th>
                    <th scope="col" className="num hide-narrow">Edges</th>
                    <th scope="col" className="num hide-narrow">Members</th>
                    <th scope="col">Your role</th>
                  </tr>
                </thead>
                <tbody onMouseEnter={loadProjectPage}>
                  {filtered.map((p) => (
                    <tr key={p.id} className="is-link" onClick={() => navigate(`/projects/${p.id}`)}>
                      <td className="primary">
                        <div className="project-cell">
                          <Monogram name={p.name} />
                          <div className="truncate">
                            <div className="project-title-row">
                              <Link to={`/projects/${p.id}`} className="project-name truncate" onClick={(e) => e.stopPropagation()}>
                                {p.name}
                              </Link>
                              {p.status === "archived" && <span className="badge badge-gray">Archived</span>}
                            </div>
                            {p.description && <span className="project-desc truncate">{p.description}</span>}
                          </div>
                        </div>
                      </td>
                      <td className="num" data-label="Nodes">{p.node_count}</td>
                      <td className="num hide-narrow" data-label="Edges">{p.edge_count}</td>
                      <td className="num hide-narrow" data-label="Members">{p.member_count}</td>
                      <td data-label="Your role"><span className={`role-chip role-${p.my_role}`}>{p.my_role}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && (
                <p className="dash-none">
                  No projects match “{query}”. <button type="button" className="btn btn-sm btn-ghost" onClick={() => setQuery("")}>Clear search</button>
                </p>
              )}
            </div>
          )}

        </div>
      </div>

      {showCreate && (
        <Modal
          title="New project"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button type="button" className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button
                className={`btn btn-primary${creating ? " is-loading" : ""}`}
                form="create-project-form"
                type="submit"
                disabled={creating}
                aria-busy={creating}
              >
                {creating ? "Creating…" : "Create project"}
              </button>
            </>
          }
        >
          {formError && <Alert>{formError}</Alert>}
          <form id="create-project-form" onSubmit={handleCreate}>
            <div className="field">
              <label htmlFor="proj-name">Project name</label>
              <input
                id="proj-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="E-Commerce API"
                required
                autoFocus
              />
            </div>
            <div className="field">
              <label htmlFor="proj-desc">Description</label>
              <textarea
                id="proj-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Core commerce services: orders, payments, users"
              />
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
