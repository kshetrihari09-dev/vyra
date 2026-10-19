import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DEFAULT_CENTER, MAP_STYLE, MAP_TOKEN } from "./config.js";
import { MAP_LOAD_TIMEOUT, describeMapError, hasWebGL, tokenProblem } from "./mapErrors.js";

/** Map for choosing a delivery pin: tap to place, drag to adjust. Lazy-loaded; `focus` ({lat,lng,n}) recentres on demand. */
export default function PinMap({ point, focus, onPoint, onError, className = "" }) {
  const box = useRef(null); const map = useRef(null); const marker = useRef(null);
  const cb = useRef(onPoint); cb.current = onPoint;
  const errCb = useRef(onError); errCb.current = onError;

  useEffect(() => {
    if (!box.current) return undefined;
    // Say WHY there's no map (customers see the plain message; the site owner gets the fix in the browser console).
    const fail = (p) => { console.warn(`[map] ${p.detail}`); errCb.current?.(p.message); };
    const bad = tokenProblem(MAP_TOKEN) || (hasWebGL() ? null : describeMapError(new Error("WebGL is not available")));
    if (bad) { fail(bad); return undefined; }
    mapboxgl.accessToken = MAP_TOKEN.trim();
    const start = point || focus || DEFAULT_CENTER;
    const m = new mapboxgl.Map({ container: box.current, style: MAP_STYLE, center: [start.lng, start.lat], zoom: point ? 16 : 13 });
    map.current = m;
    let loaded = false; let told = false;
    const tell = (p) => { if (!told) { told = true; fail(p); } };
    const timer = setTimeout(() => { if (!loaded) tell(MAP_LOAD_TIMEOUT); }, 15_000);
    m.on("load", () => { loaded = true; clearTimeout(timer); });
    m.on("error", (e) => { const p = describeMapError(e?.error); if (p) tell(p); });
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    const mk = new mapboxgl.Marker({ draggable: true, color: "#e8590c" });
    marker.current = mk;
    if (point) mk.setLngLat([point.lng, point.lat]).addTo(m);
    mk.on("dragend", () => { const p = mk.getLngLat(); cb.current({ lat: p.lat, lng: p.lng }); });
    m.on("click", (e) => { mk.setLngLat(e.lngLat).addTo(m); cb.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    return () => { clearTimeout(timer); m.remove(); map.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A pin chosen elsewhere (e.g. "Use my current location") moves the marker and the view.
  useEffect(() => {
    const m = map.current; if (!m || !point) return;
    marker.current?.setLngLat([point.lng, point.lat]).addTo(m);
  }, [point?.lat, point?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (map.current && focus) map.current.easeTo({ center: [focus.lng, focus.lat], zoom: Math.max(map.current.getZoom(), 16), duration: 500 });
  }, [focus?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={box} role="application" aria-label="Map: tap or drag the pin to your door" className={className} style={{ width: "100%" }} />;
}
