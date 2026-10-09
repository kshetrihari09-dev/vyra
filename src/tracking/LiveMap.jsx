import React, { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DEFAULT_CENTER, MAP_STYLE, MAP_TOKEN } from "./config.js";
import { distanceKm } from "./format.js";
import { NAV_CAMERA_MS, NAV_MIN_ZOOM, NAV_ZOOM, continuousBearing, createHeadingTracker, navPadding, routeHeading } from "./navCamera.js";
import { FIT_MAX_ZOOM, SINGLE_POINT_ZOOM, WORLD_ZOOM, clampPadding, cleanCoords, cleanPoint, estimateFitZoom, initialView, spanKm } from "./framing.js";
import { ROUTE_KEEP_MS, ROUTE_RETRY_MS, createSequencer, legKey, shouldRequestRoute } from "./liveRoute.js";

/**
 * The delivery map (Mapbox GL). Loaded lazily — this is the only file that imports the library.
 * Nothing here is invented: markers sit where the server says the store / customer / rider are, and the route lines come from
 * the Mapbox Directions API. If Directions fails, no line is drawn (we never fake a path). The rider marker EASES between real
 * GPS fixes so it doesn't teleport; it never moves on its own.
 *
 * props
 *   pickup, destination, rider : {lat,lng}|null          me : the viewer's own position (rider screen)
 *   phase   "to_pickup" | "to_customer"                  decides what the live route leads to
 *   primary colour for the live route / rider marker     onRoute({distanceM, durationS, receivedAt}|null)  live-leg info (null = no valid route right now)
 *   staleRider  the rider's fix has stopped updating: keep the marker, dim it, and do NOT ask Directions for a new route
 *   onError(message)                                     e.g. WebGL unavailable or token rejected
 *   navigation  RIDER SCREEN ONLY. Heading-up navigation camera: the map follows `rider`, rotates so the direction of travel is at the top,
 *               and keeps the rider in the lower-middle of the screen. A manual pan/rotate pauses following until "Recenter" is pressed.
 *               Off by default, so the customer's tracking map stays north-up. Rotation is a local camera operation only — it never
 *               triggers a route calculation (the route effects below don't depend on bearing). `rider` may carry {heading, speed, accuracy}.
 */
const RIDER_EASE_MS = 900;
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const ll = (p) => [p.lng, p.lat];
const EMPTY = { type: "FeatureCollection", features: [] };
const line = (coords) => ({ type: "FeatureCollection", features: coords ? [{ type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: coords } }] : [] });

async function directions(points, signal) {
  const coords = points.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(";");
  const res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coords}?geometries=geojson&overview=full&access_token=${encodeURIComponent(MAP_TOKEN)}`, { signal });
  if (!res.ok) return null;
  const route = (await res.json())?.routes?.[0];
  const geom = route?.geometry?.coordinates;
  return Array.isArray(geom) && geom.length >= 2 ? { coords: geom, distanceM: route.distance, durationS: route.duration } : null;
}

const SVG = {
  store: '<path d="M4 9l1.5-5h13L20 9v1a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4 0 2.5 2.5 0 0 1-4-2V9zm2 5.5V20h12v-5.5" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/>',
  home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1v-8z" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round"/>',
  rider: '<circle cx="6.5" cy="16.5" r="3" fill="none" stroke="#fff" stroke-width="1.8"/><circle cx="17.5" cy="16.5" r="3" fill="none" stroke="#fff" stroke-width="1.8"/><path d="M6.5 16.5L10 9h4l3.5 7.5M10 9L8.5 6.5H7M14 9h2.5" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
  me: '<circle cx="12" cy="12" r="4" fill="#fff"/>',
};
function pin(kind, color, label, pulse = false, arrow = false) {
  const el = document.createElement("div");
  el.setAttribute("role", "img"); el.setAttribute("aria-label", label); el.title = label;
  el.style.cssText = "position:relative;width:38px;height:38px;";
  el.innerHTML = `${pulse ? `<span style="position:absolute;inset:-6px;border-radius:50%;background:${color};opacity:.25;animation:vyra-pulse 1.8s ease-out infinite"></span>` : ""}
    <span style="position:absolute;inset:0;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 3px 10px rgba(0,0,0,.35);display:flex;align-items:center;justify-content:center">
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">${SVG[kind]}</svg></span>
    ${arrow ? `<span data-heading style="position:absolute;inset:-12px;pointer-events:none;display:none"><svg viewBox="0 0 62 62" width="62" height="62" aria-hidden="true"><path d="M31 1l8 12H23z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg></span>` : ""}`;
  return el;
}

export default function LiveMap({ pickup, destination, rider, me, phase = "to_customer", primary = "#0FAF8F", onRoute, onError, className = "", staleRider = false, navigation = false }) {
  const box = useRef(null);
  const map = useRef(null);
  const ready = useRef(false);
  const markers = useRef({});
  const anim = useRef({ raf: 0, from: null, to: null, start: 0 });
  const userMoved = useRef(false);
  const lastFit = useRef(0);
  const frame = useRef({ size: null, warned: false }); // the container size the current framing was computed for; whether we already explained a world-scale view
  const nav = useRef({ tracker: createHeadingTracker(), started: false, heading: null }); // navigation camera state (never triggers renders)
  const live = useRef({ last: null, abort: null, seq: createSequencer(), timer: 0, inFlight: false, okAt: 0, coords: null });
  const alive = useRef(true);
  const [recenter, setRecenter] = useState(false);
  const [failed, setFailed] = useState(null);
  const latest = useRef({});
  // Every coordinate is validated ONCE, here, before anything touches Mapbox (see framing.js: null silently becomes 0,0 and undefined throws).
  const pk = cleanPoint(pickup); const dst = cleanPoint(destination); const rd = cleanPoint(rider); const mePt = cleanPoint(me);
  latest.current = { pickup: pk, destination: dst, rider: rd, me: mePt, phase, onRoute, stale: staleRider, navigation };

  // ---------------------------------------------------------------- create / destroy the map once
  useEffect(() => {
    if (!MAP_TOKEN || !box.current) return undefined;
    alive.current = true;
    let m;
    try {
      mapboxgl.accessToken = MAP_TOKEN;
      // Open ALREADY framed on the real points (no guessed zoom that corrects itself after "load"), sized to the container as it is right now.
      const known = [latest.current.pickup, latest.current.destination, latest.current.rider, latest.current.me].filter(Boolean);
      const view = initialView(known, { width: box.current.clientWidth, height: box.current.clientHeight }, DEFAULT_CENTER);
      m = new mapboxgl.Map({
        container: box.current, style: MAP_STYLE, attributionControl: true, cooperativeGestures: false,
        ...(view.bounds ? { bounds: view.bounds, fitBoundsOptions: { padding: view.padding, maxZoom: FIT_MAX_ZOOM } } : { center: view.center, zoom: view.zoom }),
      });
    } catch (err) {
      const msg = "This device can't display the map (WebGL is unavailable).";
      setFailed(msg); onError?.(msg);
      return undefined;
    }
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    const reported = new Set();
    m.on("error", (e) => {
      const err = e?.error; const status = err?.status;
      if (status === 401 || status === 403) { const msg = "The map key was rejected."; setFailed(msg); onError?.(msg); }
      // Style/tile failures used to vanish silently, leaving a blank map and no clue why. Say what failed and at which zoom (never the token).
      const url = String(err?.url || "").split("?")[0]; const key = `${status}|${url}`;
      if (reported.size < 8 && !reported.has(key)) {
        reported.add(key);
        console.warn("[vyra:map] a map resource failed to load", { status, message: err?.message, url, source: e?.sourceId, zoom: Number(m.getZoom().toFixed(1)) });
      }
    });
    const watchdog = setTimeout(() => {
      if (!ready.current && alive.current) console.warn("[vyra:map] the map style has not finished loading after 10 s. Check the Network tab for api.mapbox.com/styles (401/403 = token or its URL restrictions; blocked = ad-blocker/firewall).");
    }, 10_000);
    const pause = (e) => { if (e.originalEvent) { userMoved.current = true; setRecenter(true); } }; // our own easeTo calls carry no originalEvent
    m.on("dragstart", pause);
    m.on("zoomstart", (e) => { if (!latest.current.navigation) pause(e); }); // navigation keeps the rider's chosen zoom instead of pausing on it
    m.on("rotatestart", (e) => { if (latest.current.navigation) pause(e); });
    m.on("pitchstart", (e) => { if (latest.current.navigation) pause(e); });
    m.on("rotate", () => paintHeading()); // keep the marker's arrow pointing the real way while the map turns (or if the rider rotates it by hand)
    m.on("load", () => {
      for (const [id, color, width, dash] of [["route-base", "#8aa0ab", 4, [1.5, 1.5]], ["route-live", primary, 5, null]]) {
        m.addSource(id, { type: "geojson", data: EMPTY });
        m.addLayer({ id, type: "line", source: id, layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": color, "line-width": width, "line-opacity": id === "route-live" ? 0.95 : 0.8, ...(dash ? { "line-dasharray": dash } : {}) } });
      }
      clearTimeout(watchdog);
      ready.current = true;
      m.resize();
      sync();
      requestLive(); // the first fix may have arrived before the style finished loading
    });
    m.once("idle", () => m.resize());
    // Until the user takes over, the view follows the layout: if the container settles at a different size than the one the last framing was
    // computed for (late CSS, rotation, a panel opening), frame again for the real size. resize() alone fixes the canvas but not the camera.
    let reframeTimer = 0;
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
      m.resize();
      clearTimeout(reframeTimer);
      reframeTimer = setTimeout(() => {
        const el = box.current; const f = frame.current.size;
        if (!alive.current || !ready.current || !el || userMoved.current) return;
        if (!f || Math.abs(el.clientWidth - f.width) > 8 || Math.abs(el.clientHeight - f.height) > 8) fit(true);
      }, 150);
    }) : null;
    ro?.observe(box.current);
    return () => {
      alive.current = false;
      clearTimeout(watchdog); clearTimeout(reframeTimer);
      ro?.disconnect(); cancelAnimationFrame(anim.current.raf);
      live.current.abort?.abort(); live.current.seq.invalidate(); clearTimeout(live.current.timer); live.current.inFlight = false;
      Object.values(markers.current).forEach((mk) => mk.remove()); markers.current = {};
      ready.current = false; m.remove(); map.current = null; // removing the map also removes the route sources/layers
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

  /** Frame the real points (+ the road, once known). `immediate` skips the periodic-refit throttle: a NEW ROUTE or a layout change must re-frame now. */
  function fit(force = false, immediate = false) {
    const m = map.current; if (!m || !ready.current || !box.current) return;
    if (latest.current.navigation && latest.current.rider) return; // the navigation camera owns the view (fitBounds would also reset the bearing to north)
    if (userMoved.current && !force) return;
    const { pickup: a, destination: b, rider: r, me: u } = latest.current;
    const pts = [a, b, r, u].filter(Boolean);
    if (!pts.length) return;
    if (!force && !immediate && Date.now() - lastFit.current < 8000) return; // routine re-fits as the rider moves are throttled
    lastFit.current = Date.now();
    m.resize(); // the canvas must match the container BEFORE a camera is computed for it
    const size = { width: box.current.clientWidth, height: box.current.clientHeight };
    const first = frame.current.size === null;
    frame.current.size = size;
    const duration = first || reduceMotion() ? 0 : 600;
    if (pts.length === 1) { m.easeTo({ center: ll(pts[0]), zoom: SINGLE_POINT_ZOOM, duration }); return; }
    const extra = cleanCoords(live.current.coords); // the road geometry itself, so a winding route is not cropped
    const bounds = extra.reduce((bb, c) => bb.extend(c), pts.reduce((bb, p) => bb.extend(ll(p)), new mapboxgl.LngLatBounds(ll(pts[0]), ll(pts[0]))));
    const padding = clampPadding(size); // never more padding than the container can spare, or fitBounds silently does nothing
    m.fitBounds(bounds, { padding, maxZoom: FIT_MAX_ZOOM, duration });
    explainWideFrame({ pickup: a, destination: b, rider: r, me: u }, pts, size, padding);
  }

  /** A genuinely wide frame (e.g. the rider's real GPS is far from the order's pickup/address) looks "blank": say so, once, with the numbers. */
  function explainWideFrame(named, pts, size, padding) {
    if (frame.current.warned) return;
    const z = estimateFitZoom(pts, size, padding);
    if (z == null || z >= WORLD_ZOOM) return;
    frame.current.warned = true;
    const round = (p) => p && { lat: +p.lat.toFixed(4), lng: +p.lng.toFixed(4) };
    console.warn(`[vyra:map] These points are ${Math.round(spanKm(pts))} km apart, so framing them together opens at about zoom ${z.toFixed(1)} — too wide for streets to draw. This is the GPS/order coordinates disagreeing, not a rendering fault.`,
      { pickup: round(named.pickup), destination: round(named.destination), rider: round(named.rider), me: round(named.me) });
  }

  function sync() {
    if (!map.current) return;
    const { pickup: a, destination: b, rider: r, me: u } = latest.current;
    setMarker("pickup", a, () => pin("store", "#475569", "Pickup: store"));
    setMarker("dest", b, () => pin("home", "#e8590c", "Delivery address"));
    setMarker("me", u, () => pin("me", "#2563eb", "Your location"));
    const had = !!markers.current.rider;
    setMarker("rider", r, () => pin("rider", primary, "Delivery partner", true, latest.current.navigation));
    if (r && had) easeRider(r);
    if (markers.current.rider) markers.current.rider.getElement().style.opacity = staleRider ? 0.55 : 1;
    if (latest.current.navigation && r) followRider(); else fit(!had && !!r);
  }

  // ---------------------------------------------------------------- navigation camera (rider screen only)
  // The marker is viewport-aligned (it never turns with the map), so once the map is heading-up its arrow simply points to the top of
  // the screen. The arrow is rotated by (heading − map bearing) so it stays truthful if the map is not aligned (e.g. paused/rotated).
  function paintHeading() {
    const m = map.current; const arrow = markers.current.rider?.getElement().querySelector("[data-heading]");
    if (!m || !arrow) return;
    const h = nav.current.heading;
    arrow.style.display = h == null ? "none" : "block";
    if (h != null) arrow.style.transform = `rotate(${h - m.getBearing()}deg)`;
  }

  /** Follow the rider: centre on them (offset toward the lower-middle), and turn the map to the stable travel heading. `force` = recenter. */
  function followRider(force = false) {
    const m = map.current; const { rider: r, navigation } = latest.current;
    if (!m || !ready.current || !navigation || !r || !box.current) return;
    const { heading } = nav.current.tracker.update(r, routeHeading(live.current.coords, r)); // road ahead (already in memory, no request) refines the GPS heading; keep learning the heading even while paused, so Recenter has a fresh one
    nav.current.heading = heading;
    if (userMoved.current && !force) { paintHeading(); return; } // the rider is looking around: never fight their hand
    const first = !nav.current.started;
    const opts = { center: ll(r), padding: navPadding(box.current.clientHeight), duration: first || reduceMotion() ? 0 : NAV_CAMERA_MS, easing: (t) => 1 - (1 - t) ** 3 };
    // Restate the bearing on every move once known: an easeTo that omits it would freeze a rotation that is still in progress.
    if (heading != null) opts.bearing = continuousBearing(m.getBearing(), heading);
    if (first) opts.zoom = NAV_ZOOM;
    else if (force && m.getZoom() < NAV_MIN_ZOOM) opts.zoom = NAV_MIN_ZOOM;
    nav.current.started = true;
    m.easeTo(opts);
    paintHeading();
  }

  useEffect(() => { sync(); }, [pickup?.lat, pickup?.lng, destination?.lat, destination?.lng, rider?.lat, rider?.lng, me?.lat, me?.lng, staleRider]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- routes (Directions API; no line if it fails)
  const baseKey = pk && dst ? `${pk.lat},${pk.lng}>${dst.lat},${dst.lng}` : "";
  useEffect(() => {
    if (!baseKey || !MAP_TOKEN) return undefined;
    const ac = new AbortController();
    (async () => {
      try {
        const r = await directions([latest.current.pickup, latest.current.destination], ac.signal);
        for (let i = 0; i < 20 && !ready.current && !ac.signal.aborted; i++) await new Promise((x) => setTimeout(x, 150));
        if (!ac.signal.aborted && ready.current && map.current) map.current.getSource("route-base")?.setData(line(r?.coords));
      } catch { /* aborted or offline: no line */ }
    })();
    return () => ac.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseKey]);

  // The live leg: rider → (store →) customer. WHEN to ask is decided by shouldRequestRoute (liveRoute.js): ~120 m moved or ~18 s while
  // moving, immediately on a new leg (tracking start, pickup completed, destination changed), never from a frozen GPS fix.
  // Only the newest request may publish (sequence id + AbortController); a failure never draws a line.
  function publish(r) {
    if (!alive.current) return;
    if (ready.current && map.current) map.current.getSource("route-live")?.setData(line(r?.coords));
    live.current.coords = r?.coords || null;
    latest.current.onRoute?.(r ? { distanceM: r.distanceM, durationS: r.durationS, receivedAt: Date.now() } : null);
  }

  function requestLive() {
    const l = live.current;
    const { rider: r, destination: dest, pickup: pk, phase: ph } = latest.current;
    if (!MAP_TOKEN || !alive.current || !ready.current) return;
    const key = legKey(ph, pk, dest);
    if (!r || !key) { // nothing to route (rider gone / no address): drop the old line rather than leave a wrong one
      l.abort?.abort(); l.seq.invalidate(); clearTimeout(l.timer); l.inFlight = false;
      if (l.last) { l.last = null; publish(null); }
      return;
    }
    const now = Date.now();
    if (!shouldRequestRoute({ now, rider: r, key, stale: latest.current.stale, last: l.last, inFlight: l.inFlight })) return;

    const newLeg = !l.last || l.last.key !== key;
    if (newLeg && l.last) publish(null); // the old line led somewhere else (e.g. the store): never show it as the new leg
    clearTimeout(l.timer);
    l.abort?.abort();                    // supersede any request still in flight
    const ac = new AbortController(); l.abort = ac;
    const id = l.seq.next();
    l.inFlight = true;
    l.last = { at: now, from: r, key, failed: false };
    const path = ph === "to_pickup" && pk ? [r, pk, dest] : [r, dest];
    (async () => {
      let route = null;
      try { route = await directions(path, ac.signal); } catch { route = null; } // aborted or offline
      if (ac.signal.aborted || !l.seq.isLatest(id) || !alive.current) return;  // a newer request owns the map now
      l.inFlight = false;
      if (route) { l.okAt = Date.now(); publish(route); if (newLeg) fit(false, true); return; } // re-frame NOW to include the road (not throttled); fit() still respects a customer who is exploring the map
      // Failure: keep the previous route for a while if it is still for this leg, otherwise show nothing ("Calculating route…").
      l.last = { ...l.last, failed: true };
      if (newLeg || Date.now() - l.okAt > ROUTE_KEEP_MS) publish(null);
      l.timer = setTimeout(requestLive, ROUTE_RETRY_MS);
    })();
  }

  useEffect(() => { requestLive(); }, [rider?.lat, rider?.lng, destination?.lat, destination?.lng, pickup?.lat, pickup?.lng, phase, staleRider]); // eslint-disable-line react-hooks/exhaustive-deps

  if (failed) return <div className={`flex items-center justify-center text-center text-sm p-6 ${className}`} role="status" style={{ background: "#eef3f5", color: "#4b6470" }}>{failed}</div>;
  return (
    <div className={`relative ${className}`}>
      <div ref={box} role="application" aria-label="Delivery map" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0, width: "100%", height: "100%" }} />
      {recenter && (
        <button type="button" onClick={() => { userMoved.current = false; setRecenter(false); if (latest.current.navigation && latest.current.rider) followRider(true); else fit(true); }}
          className="absolute right-3 bottom-8 z-10 px-3 h-9 rounded-full text-xs font-bold bg-white shadow-md" style={{ color: "#0b3a4a" }}>
          Recenter
        </button>
      )}
    </div>
  );
}
