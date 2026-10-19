import React, { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useC } from "../store/AppContext.jsx";
import { PillButton, InlineNotice } from "../components/shared/ui.jsx";
import { MapPin, X } from "../components/shared/Icon.jsx";
import { DEFAULT_CENTER } from "./config.js";
import { useGeocode } from "./useGeocode.js";
import { describeAccuracy, inNepal, locateAccurately, FAIR_M } from "./geo.js";
import { searchPlaces } from "./places.js";

const PinMap = lazy(() => import("./PinMap.jsx"));

/** If the map's code can't be downloaded (offline, or a stale cached page after a new release) show a message, not a blank screen. */
class MapBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.warn("[map] the map failed to load:", err?.message || err); this.props.onError?.("The map couldn't load. Check your connection and reload the page, or use “Use my current location”."); }
  render() { return this.state.failed ? null : this.props.children; }
}

/**
 * The device's position as a promise → { lat, lng, accuracy }. Called only from a button press, so the permission prompt always has an
 * obvious reason. It waits a few seconds for a GOOD fix instead of trusting the first (often coarse, sometimes cached) one;
 * `onProgress` reports improvements so the button can say how accurate it is so far.
 */
export function currentPosition({ onProgress } = {}) {
  return locateAccurately({ onProgress }).promise;
}

const accuracyNote = (accuracy) => {
  const a = describeAccuracy(accuracy);
  if (a.level === "good") return { tone: "ok", text: `Location found (${a.label}).` };
  if (a.level === "fair") return { tone: "warn", text: `Location found (${a.label}). Check the pin is at your door and drag it if not.` };
  if (a.level === "poor") return { tone: "warn", text: `Your device only found an approximate location (${a.label}). Please drag the pin to your door.` };
  return null;
};
const OUTSIDE = "This pin is outside Nepal, so it's probably not where you meant. Move it, or check your device location.";

/** Full-screen map for fine-tuning the delivery pin. Rendered in a portal so it isn't clipped by the sheet the form lives in. */
export function PinPickerModal({ value, addressText, onConfirm, onClose }) {
  const C = useC();
  const [point, setPoint] = useState(value);
  const [focus, setFocus] = useState(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const [progress, setProgress] = useState(null);
  const [note, setNote] = useState(null);
  const [mapError, setMapError] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const guess = useGeocode(addressText, { enabled: !value && !!addressText });
  useEffect(() => { if (!value && guess) setFocus({ ...guess, n: 1 }); }, [guess?.lat, guess?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const locate = async () => {
    setLocating(true); setError(""); setNote(null); setProgress(null);
    try {
      const p = await currentPosition({ onProgress: (b) => setProgress(b.accuracy) });
      setPoint({ lat: p.lat, lng: p.lng }); setFocus({ lat: p.lat, lng: p.lng, n: Date.now() }); setNote(accuracyNote(p.accuracy));
    } catch (err) { if (err.code !== -1) setError(err.message); }
    finally { setLocating(false); setProgress(null); }
  };

  // Search by place or address (Nepal only); picking a result drops the pin there and zooms in.
  useEffect(() => {
    const text = q.trim();
    if (text.length < 3) { setResults([]); return undefined; }
    const ac = new AbortController();
    const t = setTimeout(() => { searchPlaces(text, { near: point || guess || null, signal: ac.signal }).then(setResults); }, 300);
    return () => { clearTimeout(t); ac.abort(); };
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const pick = (r) => { setPoint({ lat: r.lat, lng: r.lng }); setFocus({ lat: r.lat, lng: r.lng, n: Date.now() }); setResults([]); setQ(r.name); setNote(null); setError(""); };
  const moved = (p) => { setPoint(p); setNote(null); };
  const outside = point && !inNepal(point);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Set delivery pin" className="fixed inset-0 z-[90] flex flex-col" style={{ background: C.bg }}>
      <div className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <button type="button" aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.mint }}><X size={16} style={{ color: C.primary }} /></button>
        <p className="font-extrabold" style={{ color: C.navy }}>Set delivery pin</p>
      </div>
      <div className="flex-1 relative min-h-0">
        <MapBoundary onError={setMapError}>
          <Suspense fallback={<div className="absolute inset-0 animate-pulse" style={{ background: C.mint }} />}>
            <PinMap className="absolute inset-0" point={point} focus={focus || (!value ? DEFAULT_CENTER : null)} onPoint={moved} onError={setMapError} />
          </Suspense>
        </MapBoundary>
        {mapError && (
          <div className="absolute inset-0 z-20 flex items-center justify-center p-6 text-center" style={{ background: C.bg }} role="alert">
            <div className="max-w-xs space-y-3">
              <MapPin size={28} style={{ color: C.primary }} className="mx-auto" aria-hidden="true" />
              <p className="text-sm font-semibold" style={{ color: C.navy }}>{mapError}</p>
              <PillButton onClick={locate} disabled={locating}>{locating ? "Locating…" : "Use my current location"}</PillButton>
            </div>
          </div>
        )}
        <div className="absolute left-3 right-14 top-3 z-10">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your street, area or landmark" aria-label="Search for a place"
            className="w-full rounded-full px-4 h-10 text-sm shadow outline-none" style={{ background: "#fff", color: C.navy, border: `1px solid ${C.border}` }} />
          {results.length > 0 && (
            <ul className="mt-1 rounded-2xl overflow-hidden shadow max-h-56 overflow-y-auto" style={{ background: "#fff", border: `1px solid ${C.border}` }} role="listbox">
              {results.map((r) => <li key={r.id}><button type="button" role="option" onClick={() => pick(r)} className="w-full text-left px-4 py-2.5 text-sm" style={{ color: C.navy, borderBottom: `1px solid ${C.border}` }}>{r.name}</button></li>)}
            </ul>
          )}
        </div>
        {!point && !mapError && <p className="absolute left-1/2 -translate-x-1/2 top-16 z-10 text-xs font-bold px-3 py-1.5 rounded-full bg-white shadow" style={{ color: C.navy }}>Tap the map where we should deliver</p>}
      </div>
      <div className="p-4 space-y-3 shrink-0" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
        {error && <InlineNotice tone="warn">{error}</InlineNotice>}
        {outside && <InlineNotice tone="warn">{OUTSIDE}</InlineNotice>}
        {!error && !outside && note && <InlineNotice tone={note.tone}>{note.text}</InlineNotice>}
        <div className="flex gap-2">
          <PillButton variant="subtle" onClick={locate} disabled={locating}><MapPin size={14} aria-hidden="true" /> {locating ? (progress ? `Improving… ${describeAccuracy(progress).label}` : "Locating…") : "Use my location"}</PillButton>
          <PillButton className="flex-1" disabled={!point} onClick={() => onConfirm(point)}>Confirm pin</PillButton>
        </div>
      </div>
    </div>, document.body);
}

/** The "Delivery pin" row inside the address form. */
export function PinField({ value, onChange, addressText }) {
  const C = useC();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState(null);
  const [progress, setProgress] = useState(null);
  const has = value?.lat != null && value?.lng != null;
  const useMine = async () => {
    setBusy(true); setError(""); setNote(null); setProgress(null);
    try {
      const p = await currentPosition({ onProgress: (b) => setProgress(b.accuracy) });
      onChange({ lat: p.lat, lng: p.lng }); setNote(accuracyNote(p.accuracy)); // only lat/lng are saved with the address
    } catch (err) { setError(err.message); } finally { setBusy(false); setProgress(null); }
  };
  const outside = has && !inNepal(value);
  return (
    <div className="rounded-2xl p-3.5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-start gap-2.5">
        <MapPin size={16} style={{ color: has ? C.primary : C.muted }} className="mt-0.5 shrink-0" aria-hidden="true" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold" style={{ color: C.navy }}>{has ? "Delivery pin saved" : "Add a delivery pin"}</p>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            {has ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Optional — lets you follow your order on the map and gives a more accurate arrival time."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <PillButton size="sm" variant="subtle" onClick={useMine} disabled={busy}>{busy ? (progress ? `Improving… ${describeAccuracy(progress).label}` : "Locating…") : "Use my current location"}</PillButton>
        <PillButton size="sm" variant="subtle" onClick={() => setOpen(true)}>{has ? "Adjust on map" : "Choose on map"}</PillButton>
        {has && <button type="button" className="text-xs font-bold underline px-2" style={{ color: C.muted }} onClick={() => onChange(null)}>Remove</button>}
      </div>
      {error && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: "#c92a2a" }}>{error}</p>}
      {!error && outside && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: "#c92a2a" }}>{OUTSIDE}</p>}
      {!error && !outside && note && <p className="text-xs mt-2 font-semibold" style={{ color: note.tone === "ok" ? C.primary : "#a15c00" }}>{note.text}</p>}
      {open && <PinPickerModal value={has ? { lat: value.lat, lng: value.lng } : null} addressText={addressText} onClose={() => setOpen(false)} onConfirm={(p) => { onChange(p); setOpen(false); }} />}
    </div>
  );
}
