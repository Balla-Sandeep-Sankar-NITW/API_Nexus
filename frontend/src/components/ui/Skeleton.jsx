// Placeholder shapes shown while data loads, so the page keeps its layout instead of jumping.
export function Skeleton({ width = "100%", height = 14, radius, style }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height, borderRadius: radius, ...style }} />;
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Loading your projects">
      <span className="sr-only">Loading your projects…</span>
      <div className="table-wrap" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton-line-row">
            <Skeleton width={32} height={32} radius={8} />
            <div style={{ flex: 1, display: "grid", gap: 8 }}>
              <Skeleton width="34%" height={13} />
              <Skeleton width="58%" height={11} />
            </div>
            <Skeleton width={48} height={13} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading">
      <div className="page-inner is-narrow">
        <Skeleton width={180} height={24} style={{ marginBottom: 20 }} />
        <DashboardSkeleton />
      </div>
    </div>
  );
}
