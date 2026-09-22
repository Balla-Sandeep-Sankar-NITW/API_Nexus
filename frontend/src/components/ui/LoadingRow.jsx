export default function LoadingRow({ children = "Loading…" }) {
  return (
    <div className="loading-row" role="status">
      <span className="spinner" aria-hidden="true" />
      {children}
    </div>
  );
}
