import { useEffect, useState } from "react";
import { api } from "../api/client";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

const STATUS = {
  overdue: { badge: "badge-red", label: "Overdue", help: "Past its sunset date and still in use" },
  in_use: { badge: "badge-amber", label: "Still in use", help: "Components still depend on it" },
  safe_to_remove: { badge: "badge-green", label: "Safe to remove", help: "Nothing depends on it any more" },
};

function sunsetText(d) {
  if (!d.sunset_date) return "No sunset date";
  const date = new Date(`${d.sunset_date}T00:00:00`).toLocaleDateString();
  if (d.days_left === 0) return `${date} (today)`;
  if (d.days_left > 0) return `${date} (in ${d.days_left} day${d.days_left === 1 ? "" : "s"})`;
  return `${date} (${-d.days_left} day${d.days_left === -1 ? "" : "s"} ago)`;
}

// Everything marked deprecated, who still depends on it, and when it can go.
// Mark a node deprecated from its panel: Edit node, then Lifecycle.
export default function DeprecationsPanel({ projectId, graph, onOpenNode }) {
  const [items, setItems] = useState(null);

  useEffect(() => {
    api.get(`/projects/${projectId}/deprecations`).then(setItems).catch(() => setItems([]));
  }, [projectId, graph]);

  if (items === null) return <LoadingRow>Loading deprecations…</LoadingRow>;

  if (items.length === 0) {
    return (
      <EmptyState title="Nothing is deprecated">
        Select a node on the graph, choose Edit node, and mark it as deprecated with a sunset date. It shows up here with everything that still depends on it.
      </EmptyState>
    );
  }

  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, items.filter((i) => i.status === k).length]));

  return (
    <>
      <div className="finding-counts">
        {Object.entries(STATUS).map(([key, s]) => (
          <span key={key} className={`badge ${s.badge}`} title={s.help}>
            <span className="badge-dot" aria-hidden="true" />
            {counts[key]} {s.label.toLowerCase()}
          </span>
        ))}
      </div>
      <div className="table-wrap stack">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Node</th>
              <th scope="col">Status</th>
              <th scope="col">Sunset</th>
              <th scope="col">Still used by</th>
              <th scope="col" className="hide-narrow">Owner</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => {
              const s = STATUS[d.status];
              const owner = [d.owner_team, d.owner_contact].filter(Boolean).join(", ");
              return (
                <tr key={d.node_id}>
                  <td className="primary">
                    {d.label}
                    {d.note && <span className="project-desc truncate">{d.note}</span>}
                  </td>
                  <td data-label="Status"><span className={`badge ${s.badge}`}><span className="badge-dot" aria-hidden="true" />{s.label}</span></td>
                  <td className="text-muted tabular" data-label="Sunset">{sunsetText(d)}</td>
                  <td data-label="Still used by">
                    {d.total_dependents === 0 ? (
                      <span className="text-muted">Nothing</span>
                    ) : (
                      <>
                        {d.direct_dependents.slice(0, 2).map((x) => x.label).join(", ")}
                        {d.total_dependents > Math.min(2, d.direct_dependents.length) && (
                          <span className="text-muted"> and {d.total_dependents - Math.min(2, d.direct_dependents.length)} more</span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="text-muted hide-narrow" data-label="Owner">{owner || "Unassigned"}</td>
                  <td className="actions"><button type="button" className="btn btn-sm btn-ghost" onClick={() => onOpenNode(d.node_id)}>Show</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
