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
