import { useEffect, useState } from "react";
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
            <button type="button" className="btn btn-primary" onClick={() => setShowCreate(true)}>
              New project
            </button>
          </div>

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
                            <Link to={`/projects/${p.id}`} className="project-name" onClick={(e) => e.stopPropagation()}>
                              {p.name}
                            </Link>
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
