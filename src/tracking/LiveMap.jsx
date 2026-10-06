import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DEFAULT_CENTER, MAP_STYLE, MAP_TOKEN } from "./config.js";
import { distanceKm } from "./format.js";

/**
 * The delivery map (Mapbox GL). Loaded lazily — this is the only file that imports the library.
 * Nothing here is invented: markers sit where the server says the store / customer / rider are, and the route lines come from
 * the Mapbox Directions API. If Directions fails, no line is drawn (we never fake a path). The rider marker EASES between real
 * GPS fixes so it doesn't teleport; it never moves on its own.
 *
 * props
 *   pickup, destination, rider : {lat,lng}|null          me : the viewer's own position (rider screen)
 *   phase   "to_pickup" | "to_customer"                  decides what the live route leads to
 *   primary colour for the live route / rider marker     onRoute({distanceM, durationS}|null)  live-leg info for the caller's UI
 *   onError(message)                                     e.g. WebGL unavailable or token rejected
 */
const RIDER_EASE_MS = 900;
const ROUTE_MIN_GAP_MS = 20_000;
const ROUTE_MIN_MOVE_KM = 0.12;
const FIT_PADDING = { top: 70, bottom: 70, left: 50, right: 50 };
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ll = (p) => [p.lng, p.lat];
const EMPTY = { type: "FeatureCollection", features: [] };
const line = (coords) => ({ type: "FeatureCollection", features: coords ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });

async function directions(points, signal) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(MAP_TOKEN)}`, { signal });
  if (!res.ok) return null;
  const route = (await res.json())?.routes?.[0];
  return route ? { coords: route.geometry.coordinates, distanceM: route.distance, durationS: route.duration } : null;
}

const SVG = {
  store: '<path d="M4 9l1.5-5h13L20 9v1a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4-2V9zm2 5.5V20h12v-5.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>',
  rider: '<circle cx="6.5" cy="16.5" r="3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="17.5" cy="16.5" r="3" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M6.5 16.5L10 9h4l3.5 7.5M10 9L8.5 6.5H7M14 9h2.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  me: '<circle cx="12" cy="12" r="4" fill="#fff"/>',
};
function pin(kind, color, label, pulse = false) {
  const el = document.createElement("div");
  el.setAttribute("role", "img"); el.setAttribute("aria-label", label); el.title = label;
  el.style.cssText = "position:relative;width:38px;height:38px;";
  el.innerHTML = `${pulse ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.25;animation:vyra-pulse 1.8s ease-out infinite"></span>` : ""}
    <span style="position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${SVG[kind]}</svg></span>`;
  return el;
}

export default function LiveMap({ pickup, destination, rider, me, phase = "to_customer", primary = "#0FAF8F", onRoute, onError, className = "", staleRider = false }) {
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef({});
  const anim = useRef({ raf: 0, from: null, to: null, start: 0 });
  const userMoved = useRef(false);
  const lastFit = useRef(0);
  const live = useRef({ at: 0, from: null, abort: null });
  const [recenter, setRecenter] = useState(false);
  const [failed, setFailed] = useState(null);
  const latest = useRef({});
  latest.current = { pickup, destination, rider, me, phase, onRoute };

  // ---------------------------------------------------------------- create / destroy the map once
  useEffect(() => {
    if (!MAP_TOKEN || !box.current) return undefined;
    let m;
    try {
      mapboxgl.accessToken = MAP_TOKEN;
      const first = latest.current.destination || latest.current.pickup || DEFAULT_CENTER;
      m = new mapboxgl.Map({ container: box.current, style: MAP_STYLE, center: ll(first), zoom: 13, attributionControl: true, cooperativeGestures: false });
    } catch (err) {
      const msg = "This device can't display the map (WebGL is unavailable).";
      setFailed(msg); onError?.(msg);
      return undefined;
    }
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    m.on("error", (e) => {
      const status = e?.error?.status;
      if (status === 401 || status === 403) { const msg = "The map key was rejected."; setFailed(msg); onError?.(msg); }
    });
    m.on("dragstart", (e) => { if (e.originalEvent) { userMoved.current = true; setRecenter(true); } });
    m.on("zoomstart", (e) => { if (e.originalEvent) { userMoved.current = true; setRecenter(true); } });
    m.on("load", () => {
      for (const [id, color, width, dash] of [["route-base", "#8aa0ab", 4, [1.5, 1.5]], ["route-live", primary, 5, null]]) {
        m.addSource(id, { type: "geojson", data: EMPTY });
        m.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": color, "line-width": width, "line-opacity": id === "route-live" ? 0.95 : 0.8, ...(dash ? { "line-dasharray": dash } : {}) } });
      }
      ready.current = true;
      m.resize();
      sync();
    });
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => m.resize()) : null;
    ro?.observe(box.current);
    return () => {
      ro?.disconnect(); cancelAnimationFrame(anim.current.raf); live.current.abort?.abort();
      Object.values(markers.current).forEach((mk) => mk.remove()); markers.current = {};
      ready.current = false; m.remove(); map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- markers + fitting (re-runs as props change)
  function setMarker(key, point, make) {
    const m = map.current; if (!m) return;
    if (!point) { markers.current[key]?.remove(); delete markers.current[key]; return; }
    if (!markers.current[key]) markers.current[key] = new mapboxgl.Marker({ element: make(), anchor: "center" }).setLngLat(ll(point)).addTo(m);
    else if (key !== "rider") markers.current[key].setLngLat(ll(point));
  }

  function easeRider(point) {
    const mk = markers.current.rider; if (!mk || !point) return;
    const cur = mk.getLngLat();
    cancelAnimationFrame(anim.current.raf);
    if (reduceMotion() || distanceKm({ lat: cur.lat, lng: cur.lng }, point) > 2) { mk.setLngLat(ll(point)); return; } // a long jump (first fix, reconnect) just snaps
    anim.current = { from: [cur.lng, cur.lat], to: ll(point), start: performance.now(), raf: 0 };
    const tick = (now) => {
      const a = anim.current; const t = Math.min(1, (now - a.start) / RIDER_EASE_MS); const k = 1 - (1 - t) ** 3;
      mk.setLngLat([a.from[0] + (a.to[0] - a.from[0]) * k, a.from[1] + (a.to[1] - a.from[1]) * k]);
      if (t < 1) a.raf = requestAnimationFrame(tick);
    };
    anim.current.raf = requestAnimationFrame(tick);
  }

  function fit(force = false) {
    const m = map.current; if (!m || !ready.current) return;
    if (userMoved.current && !force) return;
    const { pickup: a, destination: b, rider: r, me: u } = latest.current;
    const pts = [a, b, r, u].filter(Boolean);
    if (!pts.length) return;
    if (!force && Date.now() - lastFit.current < 8000) return;
    lastFit.current = Date.now();
    if (pts.length === 1) { m.easeTo({ center: ll(pts[0]), zoom: 15, duration: reduceMotion() ? 0 : 500 }); return; }
    const bounds = pts.reduce((bb, p) => bb.extend(ll(p)), new mapboxgl.LngLatBounds(ll(pts[0]), ll(pts[0])));
    m.fitBounds(bounds, { padding: FIT_PADDING, maxZoom: 16, duration: reduceMotion() ? 0 : 600 });
  }

  function sync() {
    if (!map.current) return;
    const { pickup: a, destination: b, rider: r, me: u } = latest.current;
    setMarker("pickup", a, () => pin("store", "#475569", "Pickup: store"));
    setMarker("dest", b, () => pin("home", "#e8590c", "Delivery address"));
    setMarker("me", u, () => pin("me", "#2563eb", "Your location"));
    const had = !!markers.current.rider;
    setMarker("rider", r, () => pin("rider", primary, "Delivery partner", true));
    if (r && had) easeRider(r);
    if (markers.current.rider) markers.current.rider.getElement().style.opacity = staleRider ? 0.55 : 1;
    fit(!had && !!r);
  }

  useEffect(() => { sync(); }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, rider?.lat, rider?.lng, me?.lat, me?.lng, staleRider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- routes (Directions API; no line if it fails)
  const baseKey = pickup && destination ? `${pickup.lat},${pickup.lng}>${destination.lat},${destination.lng}` : "";
  useEffect(() => {
    if (!baseKey || !MAP_TOKEN) return undefined;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await directions([pickup, destination], ac.signal);
        for (let i = 0; i < 20 && !ready.current && !ac.signal.aborted; i++) await new Promise((x) => setTimeout(x, 150));
        if (!ac.signal.aborted && ready.current && map.current) map.current.getSource("route-base")?.setData(line(r?.coords));
      } catch { /* aborted or offline: no line */ }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  // The live leg: rider → (store →) customer. Throttled: at most every 20 s AND only after moving ~120 m.
  useEffect(() => {
    if (!MAP_TOKEN) return;
    const m = map.current;
    const clear = () => { live.current.abort?.abort(); if (ready.current && m) m.getSource("route-live")?.setData(EMPTY); latest.current.onRoute?.(null); live.current.from = null; };
    if (!rider || !destination) { if (live.current.from) clear(); return; }
    const l = live.current;
    const moved = l.from ? distanceKm(l.from, rider) : Infinity;
    if (Date.now() - l.at < ROUTE_MIN_GAP_MS || moved < ROUTE_MIN_MOVE_KM) return;
    l.at = Date.now(); l.from = rider; l.abort?.abort();
    const ac = new AbortController(); l.abort = ac;
    const path = phase === "to_pickup" && pickup ? [rider, pickup, destination] : [rider, destination];
    (async () => {
      try {
        const r = await directions(path, ac.signal);
        if (ac.signal.aborted || !ready.current || !map.current) return;
        map.current.getSource("route-live")?.setData(line(r?.coords));
        latest.current.onRoute?.(r ? { distanceM: r.distanceM, durationS: r.durationS } : null);
      } catch { /* aborted or offline */ }
    })();
  }, [rider?.lat, rider?.lng, destination?.lat, destination?.lng, pickup?.lat, pickup?.lng, phase]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className={`flex items-center justify-center text-center text-sm p-6 ${className}`} role="status" style={{ background: "#eef3f5", color: "#4b6470" }}>{failed}</div>;
  return (
    <div className={`relative ${className}`}>
      <div ref={box} role="application" aria-label="Delivery map" className="absolute inset-0" />
      {recenter && (
        <button type="button" onClick={() => { userMoved.current = false; setRecenter(false); fit(true); }}
          className="absolute left-3 bottom-3 z-10 px-3 h-9 rounded-full text-xs font-bold bg-white shadow-md" style={{ color: "#0b3a4a" }}>
          Recenter
        </button>
      )}
    </div>
  );
}
