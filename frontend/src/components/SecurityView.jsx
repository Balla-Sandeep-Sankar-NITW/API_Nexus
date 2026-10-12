import { useEffect, useState } from "react";
import { api } from "../api/client";

const CATEGORY_LABEL = { credentials: "Credentials", payment: "Payment", personal: "Personal data" };

// Which endpoints require authentication, how well each scheme covers the API,
// and which sensitive-looking schemas can be reached without it. Everything is
// derived from the graph; the "sensitive" part is based on schema names only.
export default function SecurityView({ projectId, graph, onOpenNode }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/security`).then(setData).catch(() => setData(null));
  }, [projectId, graph]);

  if (!data) return <p className="text-sm text-muted">Checking authentication coverage…</p>;

  if (data.endpoints_total === 0) {
    return <p className="text-sm" style={{ margin: 0 }}>No API endpoints in this graph yet, so there's no authentication coverage to show.</p>;
  }

  const exposed = data.sensitive_schemas.filter((s) => s.exposed_endpoints.length > 0);

  return (
    <>
      <dl className="stat-row" aria-label="Authentication coverage">
        <div><dt>Endpoints</dt><dd>{data.endpoints_total}</dd></div>
        <div><dt>Require auth</dt><dd>{data.endpoints_protected}</dd></div>
        <div><dt>No auth</dt><dd>{data.unprotected.length}</dd></div>
        <div><dt>Coverage</dt><dd>{data.coverage_percent}%</dd></div>
      </dl>

      {exposed.length > 0 && (
        <div className="notice notice-warn">
          <strong>{exposed.length} sensitive-looking schema{exposed.length === 1 ? " is" : "s are"} reachable without authentication.</strong>{" "}
          {exposed.map((s) => s.label).join(", ")}. Check whether those endpoints should require auth.
        </div>
      )}

      {data.unprotected.length > 0 && (
        <>
          <h3 className="subhead">Endpoints without authentication</h3>
          <div className="table-wrap stack">
            <table className="table">
              <thead>
                <tr><th scope="col">Endpoint</th><th scope="col"><span className="sr-only">Actions</span></th></tr>
              </thead>
              <tbody>
                {data.unprotected.map((e) => (
                  <tr key={e.node_id}>
                    <td className="primary mono">{e.label}</td>
                    <td className="actions"><button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenNode(e.node_id)}>Show</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.schemes.length > 0 && (
        <>
          <h3 className="subhead">Auth schemes</h3>
          <div className="table-wrap stack">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Scheme</th>
                  <th scope="col" className="hide-narrow">Kind</th>
                  <th scope="col" className="num">Endpoints protected</th>
                </tr>
              </thead>
              <tbody>
                {data.schemes.map((s) => (
                  <tr key={s.node_id}>
                    <td className="primary">{s.label}</td>
                    <td className="text-muted hide-narrow" data-label="Kind">{s.description}</td>
                    <td className="num" data-label="Endpoints protected">{s.endpoint_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {data.sensitive_schemas.length > 0 && (
        <>
          <h3 className="subhead">Schemas that look sensitive</h3>
          <p className="field-hint" style={{ margin: "0 0 var(--sp-2)" }}>Picked by name (for example User, Card or Token), not by inspecting fields.</p>
          <div className="table-wrap stack">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Schema</th>
                  <th scope="col" className="hide-narrow">Looks like</th>
                  <th scope="col" className="num">Endpoints</th>
                  <th scope="col">Without auth</th>
                </tr>
              </thead>
              <tbody>
                {data.sensitive_schemas.map((s) => (
                  <tr key={s.node_id}>
                    <td className="primary">{s.label}</td>
                    <td className="text-muted hide-narrow" data-label="Looks like">{CATEGORY_LABEL[s.category]}</td>
                    <td className="num" data-label="Endpoints">{s.endpoint_count}</td>
                    <td data-label="Without auth">
                      {s.exposed_endpoints.length === 0 ? (
                        <span className="badge badge-green"><span className="badge-dot" aria-hidden="true" />None</span>
                      ) : (
                        <span className="exposed-list">
                          {s.exposed_endpoints.map((e) => (
                            <button key={e.node_id} type="button" className="link-btn mono" onClick={() => onOpenNode(e.node_id)}>{e.label}</button>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
