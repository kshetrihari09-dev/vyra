import React, { Component, Suspense, lazy } from "react";
import { MAP_TOKEN } from "./config.js";
import { directionsUrl } from "./format.js";
import { useC } from "../store/AppContext.jsx";

const LiveMap = lazy(() => import("./LiveMap.jsx"));

/** What the map area shows when there is no map: honest about why, and still useful (a link to the user's own maps app). */
export function MapUnavailable({ reason, destination, className = "" }) {
  const C = useC();
  return (
    <div className={`flex flex-col items-center justify-center text-center p-6 gap-3 ${className}`} role="status" style={{ background: C.mint, color: C.navy }}>
      <p className="text-sm font-semibold">{reason}</p>
      {destination && <a className="text-xs font-bold underline" style={{ color: C.primary }} href={directionsUrl(destination)} target="_blank" rel="noopener noreferrer">Open in Maps</a>}
    </div>
  );
}

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("[vyra] map failed to load:", err); }
  render() { return this.state.failed ? <MapUnavailable reason="The map couldn't be loaded. Your delivery status below is still live." className={this.props.className} destination={this.props.destination} /> : this.props.children; }
}

/** Eager wrapper: checks the key, lazy-loads the heavy map, and contains any failure so it can't take the page down. */
export function TrackingMap(props) {
  const C = useC();
  const { className = "", destination } = props;
  if (!MAP_TOKEN) return <MapUnavailable className={className} destination={destination} reason="Live map isn't configured yet (missing VITE_MAPBOX_TOKEN). Status and ETA below are still live." />;
  return (
    <Boundary className={className} destination={destination}>
      <Suspense fallback={<div className={`animate-pulse ${className}`} style={{ background: C.mint }} aria-busy="true" aria-label="Loading map" />}>
        <LiveMap primary={C.primary} {...props} />
      </Suspense>
    </Boundary>
  );
}
