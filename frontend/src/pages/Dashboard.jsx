import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useToast } from "../context/ToastContext";
import Modal from "../components/Modal";
import TopBar from "../components/TopBar";

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
      <TopBar breadcrumb={<span className="current">Projects</span>} />
      <div className="content">
        <div className="toolbar">
          <h1 style={{ margin: 0 }}>Projects</h1>
          <div className="toolbar-spacer" />
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            New project
          </button>
        </div>

        {projects === null && <div className="loading-row"><span className="spinner" />Loading projects…</div>}

        {projects && projects.length === 0 && (
          <div className="empty-state panel">
            <h3>No projects yet</h3>
            <p>Create a project, then import an OpenAPI spec to generate its first dependency graph.</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              Create your first project
            </button>
          </div>
        )}

        {projects && projects.length > 0 && (
          <div className="project-grid">
            {projects.map((p) => (
              <Link key={p.id} to={`/projects/${p.id}`} className="project-card">
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-desc">{p.description || "No description"}</div>
                <div className="project-card-stats">
                  <span><strong>{p.node_count}</strong> nodes</span>
                  <span><strong>{p.edge_count}</strong> edges</span>
                  <span><strong>{p.member_count}</strong> members</span>
                  <span style={{ marginLeft: "auto", textTransform: "capitalize" }}>{p.my_role}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <Modal
          title="New project"
          onClose={() => setShowCreate(false)}
          footer={
            <>
              <button className="btn" onClick={() => setShowCreate(false)}>
                Cancel
              </button>
              <button className="btn btn-primary" form="create-project-form" type="submit" disabled={creating}>
                {creating ? "Creating…" : "Create project"}
              </button>
            </>
          }
        >
          <form id="create-project-form" onSubmit={handleCreate}>
            {formError && <div className="auth-error">{formError}</div>}
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
