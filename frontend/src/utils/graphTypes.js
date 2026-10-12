// Shared option lists for node and link types. Values match the backend enums.
export const NODE_TYPES = [
  { value: "api", label: "API endpoint" },
  { value: "schema", label: "Schema" },
  { value: "auth", label: "Auth scheme" },
  { value: "service", label: "Service" },
  { value: "database", label: "Database" },
  { value: "external", label: "External service" },
  { value: "custom", label: "Custom" },
];

export const EDGE_TYPES = [
  { value: "depends_on", label: "Depends on" },
  { value: "calls", label: "Calls" },
  { value: "uses_schema", label: "Uses schema" },
  { value: "uses_auth", label: "Uses auth" },
  { value: "custom", label: "Custom" },
];

export const edgeTypeLabel = (value) => EDGE_TYPES.find((t) => t.value === value)?.label || value;
