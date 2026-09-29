export const fmt = (n) => `$${Number(n || 0).toFixed(2)}`;
export const pct = (n) => `${Math.round(n)}%`;
export const titleCase = (s) => String(s || "").replace(/(^|\s)\S/g, (t) => t.toUpperCase());

export const timeAgo = (iso) => {
  const then = new Date(iso).getTime();
  const mins = Math.round((Date.now() - then) / 60000);
  if (Number.isNaN(mins)) return "";
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
};

export const dateLabel = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
export const timeLabel = (iso) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
export const dateTimeLabel = (iso) => `${dateLabel(iso)} · ${timeLabel(iso)}`;

/** "5m ago" / "3h ago" / "2d ago", falling back to a date once it's old. Used by the notification inbox. */
export const relativeTime = (iso) => {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime());
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return dateLabel(iso);
};
