import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, EmptyState, InlineNotice, Sheet } from "../components/shared/ui.jsx";
import { Bike, MapPin, Phone, ShieldCheck, Package, Navigation, Banknote, Check } from "../components/shared/Icon.jsx";
import { deliveryApi, FAILURE_REASONS } from "../services/api/deliveryApi.js";
import { storeById } from "../data/stores.js";
import { fmt, timeLabel } from "../utils/format.js";
import { TONE } from "../theme.js";

const STATUS = {
  assigned: { label: "New — accept?", tone: "warn" },
  accepted: { label: "Accepted", tone: "info" },
  picked_up: { label: "Out for delivery", tone: "info" },
  delivered: { label: "Delivered", tone: "ok" },
  failed: { label: "Couldn't deliver", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};
const LOCATION_EVERY_MS = 10_000;

/** The rider app. Everything here talks to /api/rider/* — the server decides what a rider may do and only ever
    returns their own deliveries. The customer's handover code is never sent to this screen. */
export default function DeliveryOrders({ nav }) {
  const { toast } = useApp();
  const C = useC();
  const [rider, setRider] = useState(null);
  const [problem, setProblem] = useState(null);      // { code, message } when the account can't use the rider app
  const [tab, setTab] = useState("mine");
  const [mine, setMine] = useState([]);
  const [available, setAvailable] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [handover, setHandover] = useState(null);    // delivery being completed
  const [failing, setFailing] = useState(null);      // delivery being reported undeliverable

  const load = useCallback(async () => {
    try {
      const [r, m, a] = await Promise.all([deliveryApi.me(), deliveryApi.mine("active"), deliveryApi.available()]);
      setRider(r); setMine(m); setAvailable(a); setProblem(null);
    } catch (err) {
      if (["NOT_A_RIDER", "RIDER_SUSPENDED", "FORBIDDEN", "UNAUTHENTICATED"].includes(err.code)) setProblem({ code: err.code, message: err.message });
      else toast(err.message || "Couldn't load deliveries", "danger");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (tab === "history") deliveryApi.mine("history").then(setHistory).catch(() => {}); }, [tab]);
  // Pick up new assignments made by dispatch while the app is open.
  useEffect(() => { const t = setInterval(load, 30_000); return () => clearInterval(t); }, [load]);

  /* Share position only while at least one delivery is out. Pings are throttled here and again on the server;
     when the last run ends the server deletes the trail. */
  const outIds = mine.filter((d) => d.status === "picked_up").map((d) => d.id).join(",");
  const lastSent = useRef(0);
  useEffect(() => {
    if (!outIds || !navigator.geolocation) return undefined;
    const ids = outIds.split(",");
    const watch = navigator.geolocation.watchPosition((pos) => {
      if (Date.now() - lastSent.current < LOCATION_EVERY_MS) return;
      lastSent.current = Date.now();
      const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
      ids.forEach((id) => deliveryApi.sendLocation(id, point).catch(() => {}));
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [outIds]);

  const act = async (key, fn, message) => {
    setBusy(key);
    try { await fn(); if (message) toast(message); await load(); }
    catch (err) { toast(err.message || "That didn't work", "danger"); await load(); }
    finally { setBusy(null); }
  };

  const toggleAvailability = () => act("avail", async () => setRider(await deliveryApi.setAvailability(!rider.isAvailable)));

  if (loading) return <Page><PageHeader title="Delivery App" onBack={() => nav("profile")} /><p className="px-4 text-sm" style={{ color: C.muted }}>Loading…</p></Page>;
  if (problem) {
    return (
      <Page>
        <PageHeader title="Delivery App" onBack={() => nav("profile")} />
        <div className="px-4 md:px-0">
          <EmptyState icon={Bike} title={problem.code === "RIDER_SUSPENDED" ? "Rider account suspended" : "Not set up as a rider"}
            message={problem.code === "NOT_A_RIDER" ? "Ask dispatch to add your account as a rider, then reopen this page." : problem.message} />
        </div>
      </Page>
    );
  }

  const list = tab === "mine" ? mine : tab === "history" ? history : [];
  return (
    <Page>
      <PageHeader title="Delivery App" subtitle={`${mine.length} active run${mine.length === 1 ? "" : "s"} · ${rider?.vehicle || ""}`} onBack={() => nav("profile")}
        right={<button onClick={toggleAvailability} disabled={busy === "avail"} className="px-3 py-1.5 rounded-full text-xs font-bold"
          style={{ background: rider?.isAvailable ? TONE.ok : C.mint, color: rider?.isAvailable ? "#fff" : C.navy }}>{rider?.isAvailable ? "Available" : "Off duty"}</button>} />
      <div className="px-4 md:px-0 space-y-3">
        <InlineNotice tone="info" icon={ShieldCheck}>
          Ask the customer for their 4-digit code at the door. The order can only be completed once the server accepts it.
        </InlineNotice>

        <div className="flex gap-2">
          {[["mine", "My runs"], ["available", `Available (${available.length})`], ["history", "History"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3.5 py-2 rounded-full text-xs font-bold"
              style={{ background: tab === id ? C.primary : C.white, color: tab === id ? "#fff" : C.navy, border: `1px solid ${tab === id ? C.primary : C.border}` }}>{label}</button>
          ))}
        </div>

        {tab === "available" && (
          !rider?.isAvailable ? <InlineNotice tone="warn">Switch to Available (top right) to see and take deliveries.</InlineNotice>
          : available.length === 0 ? <EmptyState icon={Package} title="Nothing waiting" message="Packed orders that nobody has taken appear here." />
          : available.map((o) => (
            <div key={o.orderId} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}><Package size={17} style={{ color: C.primary }} /></span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm" style={{ color: C.navy }}>{o.number}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{o.itemCount} items · {fmt(o.total)} · {o.collectCash ? "Collect cash" : "Prepaid"} · {o.area}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>From {storeById(o.storeId)?.name}</p>
                </div>
                <PillButton size="sm" disabled={busy === o.orderId} onClick={() => act(o.orderId, () => deliveryApi.claim(o.orderId), `${o.number} is yours`)}>Take it</PillButton>
              </div>
            </div>
          ))
        )}

        {tab !== "available" && list.length === 0 && (
          <EmptyState icon={Package} title={tab === "mine" ? "No active runs" : "No past deliveries"}
            message={tab === "mine" ? "Orders assigned to you — or taken from the Available tab — appear here." : "Finished runs will show here."} />
        )}

        {tab !== "available" && list.map((d) => <RunCard key={d.id} d={d} busy={busy === d.id} history={tab === "history"}
          onAccept={() => act(d.id, () => deliveryApi.accept(d.id), "Accepted")}
          onDecline={() => act(d.id, () => deliveryApi.decline(d.id), "Handed back to dispatch")}
          onPickup={() => act(d.id, () => deliveryApi.pickup(d.id), "Out for delivery")}
          onComplete={() => setHandover(d)} onFail={() => setFailing(d)} />)}
      </div>

      <HandoverSheet delivery={handover} onClose={() => setHandover(null)} onDone={async () => { setHandover(null); toast("Delivery completed"); await load(); }} />
      <FailSheet delivery={failing} onClose={() => setFailing(null)}
        onDone={async (res) => { setFailing(null); toast(res.orderOutcome === "returned" ? "Order closed as returned — bring it back to the store" : "Reported. The order goes back for re-dispatch."); await load(); }} />
    </Page>
  );
}

function RunCard({ d, busy, history, onAccept, onDecline, onPickup, onComplete, onFail }) {
  const C = useC();
  const s = STATUS[d.status] || { label: d.status, tone: "neutral" };
  const a = d.order.shipTo || {};
  const address = [a.line1, a.line2, a.city, a.zip].filter(Boolean).join(", ");
  return (
    <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-3 mb-3">
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}><Bike size={17} style={{ color: C.primary }} /></span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: C.navy }}>{d.order.number}</p>
          <p className="text-[11px]" style={{ color: C.muted }}>{d.order.itemCount} items · {fmt(d.order.total)} · {d.order.collectCash ? "Collect cash" : "Prepaid"}</p>
        </div>
        <Badge tone={s.tone}>{s.label}</Badge>
      </div>

      <div className="rounded-xl p-3 space-y-2" style={{ background: C.bg }}>
        <Line icon={Package}>Pick up from {storeById(d.order.storeId)?.name}</Line>
        {address && (
          <Line icon={MapPin}>
            {a.name ? <b>{a.name} · </b> : null}{address}
            {a.instructions && <span className="block italic mt-0.5" style={{ color: C.muted }}>“{a.instructions}”</span>}
          </Line>
        )}
        {d.order.eta && !history && <Line icon={ShieldCheck}>Due by {timeLabel(d.order.eta)}{d.order.otpRequired ? " · customer code required" : ""}</Line>}
        {d.failureReason && <Line icon={Navigation}>Reason: {FAILURE_REASONS.find((r) => r.id === d.failureReason)?.label || d.failureReason}</Line>}
      </div>

      {!history && (
        <div className="flex flex-wrap gap-2 mt-3">
          {a.phone && ["accepted", "picked_up"].includes(d.status) && (
            <a href={`tel:${a.phone}`} className="px-3 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}><Phone size={13} /> Call</a>
          )}
          {address && d.status === "picked_up" && (
            <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer"
              className="px-3 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}><Navigation size={13} /> Navigate</a>
          )}
          {d.status === "assigned" && <><PillButton size="sm" variant="subtle" disabled={busy} onClick={onDecline}>Decline</PillButton><PillButton size="sm" className="flex-1" disabled={busy} onClick={onAccept}>Accept</PillButton></>}
          {d.status === "accepted" && <><PillButton size="sm" variant="subtle" disabled={busy} onClick={onDecline}>Give back</PillButton><PillButton size="sm" className="flex-1" disabled={busy} onClick={onPickup}>Picked up — start</PillButton></>}
          {d.status === "picked_up" && <><PillButton size="sm" variant="subtle" disabled={busy} onClick={onFail}>Couldn't deliver</PillButton><PillButton size="sm" className="flex-1" disabled={busy} onClick={onComplete}>Complete delivery</PillButton></>}
        </div>
      )}
    </div>
  );
}

function Line({ icon: IconCmp, children }) {
  const C = useC();
  return (
    <div className="flex items-start gap-2">
      <IconCmp size={13} style={{ color: C.muted }} className="mt-0.5 shrink-0" />
      <p className="text-xs" style={{ color: C.navy }}>{children}</p>
    </div>
  );
}

/** The rider types the customer's code; the SERVER checks it (and counts wrong tries). Nothing about the code is known here. */
function HandoverSheet({ delivery, onClose, onDone }) {
  const C = useC();
  const [otp, setOtp] = useState("");
  const [cash, setCash] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setOtp(""); setCash(false); setError(""); }, [delivery?.id]);
  if (!delivery) return null;
  const needsOtp = delivery.order.otpRequired;
  const needsCash = delivery.order.collectCash;
  const ready = (!needsOtp || otp.length === 4) && (!needsCash || cash);

  const submit = async () => {
    setBusy(true); setError("");
    try {
      await deliveryApi.deliver(delivery.id, { otp: needsOtp ? otp : undefined, cashCollected: needsCash ? delivery.order.total : undefined });
      await onDone();
    } catch (err) {
      setError(err.message || "Couldn't complete the delivery");
      if (err.code === "OTP_MISMATCH") setOtp("");
    } finally { setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title={`Complete ${delivery.order.number}`}
      footer={<PillButton full onClick={submit} disabled={!ready || busy}><Check size={15} /> {busy ? "Checking…" : "Confirm delivery"}</PillButton>}>
      {needsOtp && (
        <>
          <p className="text-sm mb-3" style={{ color: C.muted }}>Ask the customer to read out the 4-digit code from their app.</p>
          <input value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} inputMode="numeric" placeholder="0000" aria-label="Customer delivery code" autoFocus
            className="w-full text-center tracking-[0.5em] font-extrabold text-2xl rounded-2xl h-16 outline-none"
            style={{ background: C.white, border: `1.5px solid ${error ? TONE.danger : C.border}`, color: C.navy }} />
        </>
      )}
      {needsCash && (
        <label className="flex items-center gap-3 rounded-2xl p-3.5 mt-4 cursor-pointer" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} className="w-5 h-5" />
          <Banknote size={18} style={{ color: C.primary }} />
          <span className="text-sm font-bold" style={{ color: C.navy }}>I collected {fmt(delivery.order.total)} in cash</span>
        </label>
      )}
      {!needsOtp && !needsCash && <p className="text-sm" style={{ color: C.muted }}>This order doesn't need a code or cash. Confirm once it's in the customer's hands.</p>}
      {error && <p className="text-xs mt-3 font-semibold" style={{ color: TONE.danger }}>{error}</p>}
    </Sheet>
  );
}

function FailSheet({ delivery, onClose, onDone }) {
  const C = useC();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setReason(""); setNote(""); setError(""); }, [delivery?.id]);
  if (!delivery) return null;
  const submit = async () => {
    setBusy(true); setError("");
    try { onDone(await deliveryApi.fail(delivery.id, { reason, note })); }
    catch (err) { setError(err.message || "Couldn't report this delivery"); }
    finally { setBusy(false); }
  };
  return (
    <Sheet open onClose={onClose} title="Couldn't deliver"
      footer={<PillButton full variant="danger" onClick={submit} disabled={!reason || busy}>{busy ? "Sending…" : "Report and return to store"}</PillButton>}>
      <p className="text-sm mb-3" style={{ color: C.muted }}>Pick the reason. The order goes back to dispatch; after a second failed attempt it's closed as returned.</p>
      <div className="space-y-2">
        {FAILURE_REASONS.map((r) => (
          <button key={r.id} onClick={() => setReason(r.id)} className="w-full text-left rounded-xl px-4 py-3 text-sm font-semibold"
            style={{ background: C.white, border: `1.5px solid ${reason === r.id ? C.primary : C.border}`, color: C.navy }}>{r.label}</button>
        ))}
      </div>
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 300))} placeholder="Note for dispatch (optional)" rows={3}
        className="w-full mt-3 rounded-xl p-3 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      {error && <p className="text-xs mt-3 font-semibold" style={{ color: TONE.danger }}>{error}</p>}
    </Sheet>
  );
}
