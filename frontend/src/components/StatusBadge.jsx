const STATUS_MAP = {
  active: { color: "green", label: "Active" },
  frozen: { color: "red", label: "Frozen" },
  impacted: { color: "amber", label: "Impacted" },
  unaffected: { color: "gray", label: "Unaffected" },
  selected: { color: "blue", label: "Selected" },
};

export default function StatusBadge({ status, label }) {
  const meta = STATUS_MAP[status] || { color: "gray", label: status };
  return (
    <span className={`badge badge-${meta.color}`}>
      <span className="badge-dot" />
      {label || meta.label}
    </span>
  );
}
