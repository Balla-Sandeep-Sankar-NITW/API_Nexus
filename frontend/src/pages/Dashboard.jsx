import { useEffect, useMemo, useState } from "react";
import { describeAction } from "../utils/actions";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import Alert from "../components/ui/Alert";
import Monogram from "../components/ui/Monogram";
import EmptyState from "../components/ui/EmptyState";
import LoadingRow from "../components/ui/LoadingRow";

export default function Dashboard() {
  const [projects, setProjects] = useState(null);
  const [activity, setActivity] = useState(null);
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
      .then(setProjects)
      .catch((err) => push(err.message, "error"));
  }

  useEffect(loadProjects, []);

  // History is only fetched once it's opened.
  useEffect(() => {
    if (!showHistory || activity !== null) return;
    api.get("/me/activity").then(setActivity).catch(() => setActivity([]));
  }, [showHistory, activity]);

  const totals = useMemo(() => {
    const list = projects || [];
    return {
      projects: list.length,
      nodes: list.reduce((n, p) => n + p.node_count, 0),
      edges: list.reduce((n, p) => n + p.edge_count, 0),
      members: list.reduce((n, p) => n + p.member_count, 0),
    };
  }, [projects]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const project = await api.post("/projects", { name, description });
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
      <div className="topbar">
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
              {activity === null && <LoadingRow>Loading history…</LoadingRow>}
              {activity && activity.length === 0 && <p className="text-sm text-muted" style={{ margin: 0 }}>Nothing has changed yet.</p>}
              {activity && activity.length > 0 && (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">What happened</th>
                        <th scope="col">On</th>
                        <th scope="col">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activity.slice(0, 10).map((a) => (
                        <tr key={a.id}>
                          <td className="primary" title={a.action}>{describeAction(a.action)}</td>
                          <td className="text-muted" data-label="On">{a.target}</td>
                          <td className="text-muted tabular" data-label="When" style={{ whiteSpace: "nowrap" }}>{new Date(a.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {projects === null && <LoadingRow>Loading projects…</LoadingRow>}

          {projects && projects.length === 0 && (
            <EmptyState
              title="No projects yet"
              action={
                <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
                  Create a project
                </button>
              }
            >
              Create a project, then import an OpenAPI spec to generate its first dependency graph.
            </EmptyState>
          )}

          {projects && projects.length > 0 && (
            <dl className="stat-row" aria-label="Totals across your projects">
              <div><dt>Projects</dt><dd>{totals.projects}</dd></div>
              <div><dt>Nodes</dt><dd>{totals.nodes}</dd></div>
              <div><dt>Dependency links</dt><dd>{totals.edges}</dd></div>
              <div><dt>Memberships</dt><dd>{totals.members}</dd></div>
            </dl>
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
                <tbody>
                  {projects.map((p) => (
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
