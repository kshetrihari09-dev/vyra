import React, { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useC } from "../store/AppContext.jsx";
import { PillButton, InlineNotice } from "../components/shared/ui.jsx";
import { MapPin, X } from "../components/shared/Icon.jsx";
import { DEFAULT_CENTER, MAP_TOKEN } from "./config.js";
import { useGeocode } from "./useGeocode.js";

const PinMap = lazy(() => import("./PinMap.jsx"));

/** Browser geolocation as a promise. Called only from a button press, so the permission prompt always has an obvious reason. */
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(Object.assign(new Error("This device can't share its location."), { code: 0 }));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (err) => reject(Object.assign(new Error(err.code === 1 ? "Location permission is blocked. Allow it in your browser settings, or drop the pin on the map instead." : "Couldn't get your location. Try again, or drop the pin on the map."), { code: err.code })),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 });
  });
}

/** Full-screen map for fine-tuning the delivery pin. Rendered in a portal so it isn't clipped by the sheet the form lives in. */
export function PinPickerModal({ value, addressText, onConfirm, onClose }) {
  const C = useC();
  const [point, setPoint] = useState(value);
  const [focus, setFocus] = useState(null);
  const [error, setError] = useState("");
  const [locating, setLocating] = useState(false);
  const guess = useGeocode(addressText, { enabled: !value && !!addressText });
  useEffect(() => { if (!value && guess) setFocus({ ...guess, n: 1 }); }, [guess?.lat, guess?.lng]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const locate = async () => {
    setLocating(true); setError("");
    try { const p = await currentPosition(); setPoint(p); setFocus({ ...p, n: Date.now() }); }
    catch (err) { setError(err.message); }
    finally { setLocating(false); }
  };

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Set delivery pin" className="fixed inset-0 z-[90] flex flex-col" style={{ background: C.bg }}>
      <div className="flex items-center gap-3 px-4 h-14 shrink-0" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
        <button type="button" aria-label="Close" onClick={onClose} className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: C.mint }}><X size={16} style={{ color: C.primary }} /></button>
        <p className="font-extrabold" style={{ color: C.navy }}>Set delivery pin</p>
      </div>
      <div className="flex-1 relative min-h-0">
        <Suspense fallback={<div className="absolute inset-0 animate-pulse" style={{ background: C.mint }} />}>
          <PinMap className="absolute inset-0" point={point} focus={focus || (!value ? DEFAULT_CENTER : null)} onPoint={setPoint} />
        </Suspense>
        {!point && <p className="absolute left-1/2 -translate-x-1/2 top-3 z-10 text-xs font-bold px-3 py-1.5 rounded-full bg-white shadow" style={{ color: C.navy }}>Tap the map where we should deliver</p>}
      </div>
      <div className="p-4 space-y-3 shrink-0" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
        {error && <InlineNotice tone="warn">{error}</InlineNotice>}
        <div className="flex gap-2">
          <PillButton variant="subtle" onClick={locate} disabled={locating}><MapPin size={14} aria-hidden="true" /> {locating ? "Locating…" : "Use my location"}</PillButton>
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
  const has = value?.lat != null && value?.lng != null;
  const useMine = async () => {
    setBusy(true); setError("");
    try { onChange(await currentPosition()); } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
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
        <PillButton size="sm" variant="subtle" onClick={useMine} disabled={busy}>{busy ? "Locating…" : "Use my current location"}</PillButton>
        {MAP_TOKEN && <PillButton size="sm" variant="subtle" onClick={() => setOpen(true)}>{has ? "Adjust on map" : "Choose on map"}</PillButton>}
        {has && <button type="button" className="text-xs font-bold underline px-2" style={{ color: C.muted }} onClick={() => onChange(null)}>Remove</button>}
      </div>
      {error && <p className="text-xs mt-2 font-semibold" role="alert" style={{ color: "#c92a2a" }}>{error}</p>}
      {open && <PinPickerModal value={has ? { lat: value.lat, lng: value.lng } : null} addressText={addressText} onClose={() => setOpen(false)} onConfirm={(p) => { onChange(p); setOpen(false); }} />}
    </div>
  );
}
