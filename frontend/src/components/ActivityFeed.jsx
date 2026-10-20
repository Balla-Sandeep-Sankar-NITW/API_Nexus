import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { describeAction } from "../utils/actions";
import { PRESETS, rangeFor, describeFilter, isAll } from "../utils/dateRanges";
import EmptyState from "./ui/EmptyState";
import LoadingRow from "./ui/LoadingRow";

// A filterable, pageable list of audit-log entries. Used for a project's Activity tab
// and for the Projects page's History panel; `path` is the endpoint that returns the
// entries (both accept since / until / page / page_size).
export default function ActivityFeed({ path, pageSize = 50, emptyTitle = "No activity yet", emptyText }) {
  const [filter, setFilter] = useState({ preset: "all" });
  const [logs, setLogs] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef(0); // ignore replies that arrive after the filter has changed again

  const fetchPage = useCallback(
    async (f, pageNumber) => {
      const { since, until } = rangeFor(f);
      const params = new URLSearchParams({ page: String(pageNumber), page_size: String(pageSize) });
      if (since) params.set("since", since);
      if (until) params.set("until", until);
      return api.get(`${path}?${params}`);
    },
    [path, pageSize]
  );

  const filterKey = JSON.stringify(filter);
  useEffect(() => {
    const id = ++requestId.current;
    setLogs(null);
    setError("");
    fetchPage(filter, 1)
      .then((rows) => {
        if (id !== requestId.current) return;
        setLogs(rows);
        setPage(1);
        setHasMore(rows.length === pageSize);
      })
      .catch((err) => {
        if (id !== requestId.current) return;
        setLogs([]);
        setHasMore(false);
        setError(err.message);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, fetchPage]);

  async function loadMore() {
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const rows = await fetchPage(filter, page + 1);
      if (id !== requestId.current) return;
      setLogs((current) => [...current, ...rows]);
      setPage(page + 1);
      setHasMore(rows.length === pageSize);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  const activePreset = filter.day || filter.month ? null : filter.preset;

  return (
    <div className="activity-feed">
      <div className="activity-filter" role="group" aria-label="Show activity from">
        <div className="activity-presets">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className="chip" aria-pressed={activePreset === p.id} onClick={() => setFilter({ preset: p.id })}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="activity-pickers">
          <label>
            <span>Day</span>
            <input
              type="date"
              value={filter.day || ""}
              max={new Date().toLocaleDateString("en-CA")}
              onChange={(e) => setFilter(e.target.value ? { day: e.target.value } : { preset: "all" })}
            />
          </label>
          <label>
            <span>Month</span>
            <input
              type="month"
              value={filter.month || ""}
              max={new Date().toLocaleDateString("en-CA").slice(0, 7)}
              onChange={(e) => setFilter(e.target.value ? { month: e.target.value } : { preset: "all" })}
            />
          </label>
        </div>
      </div>

      {logs === null && <LoadingRow>Loading activity…</LoadingRow>}
      {error && <p className="field-error" role="alert">{error}</p>}

      {logs && logs.length === 0 && !error && (
        isAll(filter) ? (
          <EmptyState title={emptyTitle}>{emptyText || "Actions like imports, node changes, and freezes will show up here."}</EmptyState>
        ) : (
          <EmptyState
            title="Nothing happened in this period"
            action={<button type="button" className="btn btn-sm" onClick={() => setFilter({ preset: "all" })}>Show all logs</button>}
          >
            No activity for {describeFilter(filter).toLowerCase()}.
          </EmptyState>
        )
      )}

      {logs && logs.length > 0 && (
        <>
          <p className="activity-count" aria-live="polite">
            {logs.length} {logs.length === 1 ? "entry" : "entries"}{hasMore ? " so far" : ""} · {describeFilter(filter)}
          </p>
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
                {logs.map((log) => (
                  <tr key={log.id}>
                    <td className="primary" title={log.action}>{describeAction(log.action)}</td>
                    <td className="text-muted" data-label="On">{log.target}</td>
                    <td className="text-muted tabular" data-label="When" style={{ whiteSpace: "nowrap" }}>{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore && (
            <button type="button" className={`btn btn-sm activity-more${loadingMore ? " is-loading" : ""}`} onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
