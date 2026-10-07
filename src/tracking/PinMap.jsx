import React, { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { DEFAULT_CENTER, MAP_STYLE, MAP_TOKEN } from "./config.js";

/** Map for choosing a delivery pin: tap to place, drag to adjust. Lazy-loaded; `focus` ({lat,lng,n}) recentres on demand. */
export default function PinMap({ point, focus, onPoint, className = "" }) {
  const box = useRef(null); const map = useRef(null); const marker = useRef(null);
  const cb = useRef(onPoint); cb.current = onPoint;

  useEffect(() => {
    if (!MAP_TOKEN || !box.current) return undefined;
    mapboxgl.accessToken = MAP_TOKEN;
    const start = point || focus || DEFAULT_CENTER;
    const m = new mapboxgl.Map({ container: box.current, style: MAP_STYLE, center: [start.lng, start.lat], zoom: point ? 16 : 13 });
    map.current = m;
    m.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    const mk = new mapboxgl.Marker({ draggable: true, color: "#e8590c" });
    marker.current = mk;
    if (point) mk.setLngLat([point.lng, point.lat]).addTo(m);
    mk.on("dragend", () => { const p = mk.getLngLat(); cb.current({ lat: p.lat, lng: p.lng }); });
    m.on("click", (e) => { mk.setLngLat(e.lngLat).addTo(m); cb.current({ lat: e.lngLat.lat, lng: e.lngLat.lng }); });
    return () => { m.remove(); map.current = null; };
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
