// Time ranges for filtering the activity log. "Today", "This month" and a picked
// day or month are all in the viewer's local time, then sent to the server as UTC.

export const PRESETS = [
  { id: "hour", label: "Last hour" },
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "This month" },
  { id: "all", label: "All logs" },
];

// Parse "YYYY-MM-DD" / "YYYY-MM" as LOCAL dates. (new Date("2026-10-12") would be UTC midnight,
// which is the previous evening in the Americas.)
function localDay(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function localMonth(value) {
  const [y, m] = value.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

// filter is one of { preset: "hour" | "today" | "week" | "month" | "all" }, { day: "YYYY-MM-DD" }, { month: "YYYY-MM" }
// Returns { since, until } as ISO strings (either may be undefined). since is inclusive, until exclusive.
export function rangeFor(filter, now = new Date()) {
  if (filter.day) {
    const start = localDay(filter.day);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1);
    return { since: start.toISOString(), until: end.toISOString() };
  }
  if (filter.month) {
    const start = localMonth(filter.month);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { since: start.toISOString(), until: end.toISOString() };
  }
  switch (filter.preset) {
    case "hour":
      return { since: new Date(now.getTime() - 60 * 60 * 1000).toISOString() };
    case "today":
      return { since: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString() };
    case "week":
      return { since: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString() };
    case "month":
      return { since: new Date(now.getFullYear(), now.getMonth(), 1).toISOString() };
    default:
      return {};
  }
}

export function describeFilter(filter) {
  if (filter.day) return localDay(filter.day).toLocaleDateString(undefined, { dateStyle: "long" });
  if (filter.month) return localMonth(filter.month).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  return PRESETS.find((p) => p.id === filter.preset)?.label ?? "All logs";
}

export const isAll = (filter) => !filter.day && !filter.month && (filter.preset ?? "all") === "all";
