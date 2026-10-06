import { timeLabel } from "../utils/format.js";

const EARTH_KM = 6371;
const rad = (d) => (d * Math.PI) / 180;
export function distanceKm(a, b) {
  if (!a || !b) return null;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
export const formatKm = (km) => (km == null ? "" : km < 1 ? `${Math.round(km * 1000 / 10) * 10} m` : `${km.toFixed(1)} km`);

/** Headline for the ETA: "Arriving in 12 min". `minutes` comes from the server; the clock time is shown beside it. */
export function etaHeadline(eta) {
  if (!eta?.at) return null;
  const m = eta.minutes;
  if (m == null) return `Arriving by ${timeLabel(eta.at)}`;
  if (m <= 1) return "Arriving now";
  if (m < 60) return `Arriving in ${m} min`;
  const h = Math.floor(m / 60);
  return `Arriving in ${h} h ${m % 60} min`;
}

/** "just now" / "40 s ago" / "3 min ago" — for how fresh the rider's position is. */
export function agoText(iso, now = Date.now()) {
  if (!iso) return "";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
}
export const STALE_AFTER_MS = 60_000;

export const initials = (name = "") => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

/** A "get directions" link that opens the user's own maps app — we never embed a second navigation engine. */
export const directionsUrl = (to, from) =>
  `https://www.google.com/maps/dir/?api=1&destination=${to.lat},${to.lng}${from ? `&origin=${from.lat},${from.lng}` : ""}&travelmode=driving`;
