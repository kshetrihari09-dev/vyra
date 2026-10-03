import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, EmptyState, ErrorState, PillButton, Sheet, Spinner } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";
import { deliveryApi, VEHICLE_TYPES, composeVehicle } from "../services/api/deliveryApi.js";
import { hasPermission } from "../services/access.js";
import { capacityLine, stateMeta, vehicleLine } from "../delivery/riderState.js";
import RiderApplications from "./RiderApplications.jsx";

/* Rider management. A rider is an EXISTING user account + the `delivery` role + a profile (phone, vehicle). This page never
   creates accounts and never stores credentials: "Add rider" picks a user that already exists. Everything shown here comes
   from the server, including each rider's state and capacity. */
export default function AdminRiders() {
  const C = useC();
  const { session } = useApp();
  const canCreate = hasPermission(session, "roles:assign"); // the API also needs it; this only hides a button that would 403
  const [tab, setTab] = useState("riders");
  const [refreshKey, setRefreshKey] = useState(0); // an approval adds a rider: remount the list so it reloads
  return (
    <div>
      {canCreate && (
        <div className="flex gap-2 mb-4">
          {[["riders", "Riders"], ["applications", "Applications"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} className="px-3.5 py-2 rounded-full text-xs font-bold"
              style={{ background: tab === id ? C.primary : C.white, color: tab === id ? "#fff" : C.navy, border: `1px solid ${tab === id ? C.primary : C.border}` }}>{label}</button>
          ))}
        </div>
      )}
      {tab === "applications" && canCreate
        ? <RiderApplications onApproved={() => setRefreshKey((k) => k + 1)} />
        : <RiderList key={refreshKey} canCreate={canCreate} />}
    </div>
  );
}

function RiderList({ canCreate }) {
  const C = useC();
  const { toast } = useApp();
  const [riders, setRiders] = useState(null);
  const [error, setError] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current; // ignore a slower, older response arriving after a newer one
    try { const list = await deliveryApi.riders(); if (seq === loadSeq.current) { setRiders(list); setError(""); } }
    catch (err) { if (seq === loadSeq.current) setError(err.message || "Couldn't load riders"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const toggleStatus = async (r) => {
    if (busyId) return;
    setBusyId(r.id);
    try {
      await deliveryApi.updateRider(r.id, { status: r.status === "active" ? "suspended" : "active" });
      toast(r.status === "active" ? `${r.name} deactivated` : `${r.name} reactivated`);
      await load();
    } catch (err) { toast(err.message || "Couldn't update the rider", "danger"); }
    finally { setBusyId(null); }
  };

  if (riders === null && !error) return <div className="py-16 flex justify-center"><Spinner size={26} /></div>;
  if (riders === null) return <ErrorState title="Couldn't load riders" message={error} onRetry={load} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm" style={{ color: C.muted }}>{riders.length} rider{riders.length === 1 ? "" : "s"}</p>
        {canCreate && <PillButton size="sm" onClick={() => setAdding(true)}>Add rider</PillButton>}
      </div>
      {error && <p className="text-xs mb-3" role="alert" style={{ color: C.muted }}>Showing the last loaded list — refresh failed: {error}</p>}

      {riders.length === 0 ? (
        <EmptyState icon={() => <Icon name="Bike" size={26} />} title="No riders yet" message="Pick an existing user and give them a vehicle to start dispatching deliveries."
          action={canCreate ? "Add rider" : undefined} onAction={() => setAdding(true)} />
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          {riders.map((r, i) => {
            const meta = stateMeta(r);
            return (
              <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center gap-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{r.name}</p>
                    <Badge tone={meta.tone}>{meta.label}</Badge>
                  </div>
                  <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{r.phone} · {vehicleLine(r)}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>
                    {r.status === "active" ? "Active" : "Inactive"} · {r.isAvailable ? "On duty" : "Off duty"} · {capacityLine(r)}
                  </p>
                </div>
                <PillButton size="sm" variant="subtle" disabled={busyId === r.id} onClick={() => toggleStatus(r)}>
                  {busyId === r.id ? "…" : r.status === "active" ? "Deactivate" : "Reactivate"}
                </PillButton>
              </div>
            );
          })}
        </div>
      )}

      <AddRiderSheet open={adding} onClose={() => setAdding(false)} existingUserIds={riders.map((r) => r.userId)}
        onCreated={async (name) => { setAdding(false); toast(`${name} is now a rider`); await load(); }} />
    </div>
  );
}

function AddRiderSheet({ open, onClose, existingUserIds, onCreated }) {
  const C = useC();
  const { toast } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [user, setUser] = useState(null);
  const [phone, setPhone] = useState("");
  const [type, setType] = useState(VEHICLE_TYPES[0]);
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const submitting = useRef(false);
  const searchSeq = useRef(0);

  useEffect(() => { if (!open) { setQuery(""); setResults([]); setUser(null); setPhone(""); setType(VEHICLE_TYPES[0]); setPlate(""); setFormError(""); setSearchError(""); } }, [open]);

  useEffect(() => { // debounced user lookup; stale responses are dropped
    if (!open || user) return undefined;
    const seq = ++searchSeq.current;
    setSearching(true);
    const t = setTimeout(async () => {
      try { const items = await deliveryApi.findUsers(query.trim()); if (seq === searchSeq.current) { setResults(items); setSearchError(""); } }
      catch (err) { if (seq === searchSeq.current) setSearchError(err.status === 403 ? "You don't have permission to look up users." : err.message || "Couldn't search users"); }
      finally { if (seq === searchSeq.current) setSearching(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open, user]);

  const submit = async () => {
    if (submitting.current) return; // one request per click, even on a fast double-tap
    if (!user) { setFormError("Choose a user first."); return; }
    if (!phone.trim()) { setFormError("Enter the rider's phone number."); return; }
    submitting.current = true; setBusy(true); setFormError("");
    try {
      await deliveryApi.createRider({ userId: user.id, phone: phone.trim(), vehicle: composeVehicle(type, plate) });
      await onCreated(user.name);
    } catch (err) { setFormError(err.message || "Couldn't create the rider"); toast(err.message || "Couldn't create the rider", "danger"); }
    finally { submitting.current = false; setBusy(false); }
  };

  const field = { background: C.white, border: `1px solid ${C.border}`, color: C.navy };
  const available = results.filter((u) => !existingUserIds.includes(u.id));

  return (
    <Sheet open={open} onClose={onClose} title="Add rider">
      <div className="space-y-3">
        {!user ? (
          <>
            <label className="block text-xs font-bold" style={{ color: C.muted }}>Existing user
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or phone" autoFocus
                className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none" style={field} />
            </label>
            {searchError && <p className="text-xs" role="alert" style={{ color: C.muted }}>{searchError}</p>}
            <div className="space-y-1.5">
              {searching && <p className="text-xs" style={{ color: C.muted }}>Searching…</p>}
              {!searching && !searchError && available.length === 0 && <p className="text-xs" style={{ color: C.muted }}>No matching active users who aren't riders already.</p>}
              {available.map((u) => (
                <button key={u.id} onClick={() => { setUser(u); if (u.mobile && !phone) setPhone(u.mobile); }} className="w-full text-left rounded-xl px-4 py-2.5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                  <span className="block text-sm font-bold" style={{ color: C.navy }}>{u.name}</span>
                  <span className="block text-[11px]" style={{ color: C.muted }}>{u.email || u.mobile}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: C.mint }}>
              <span><span className="block text-sm font-bold" style={{ color: C.primary }}>{user.name}</span><span className="block text-[11px]" style={{ color: C.muted }}>{user.email || user.mobile}</span></span>
              <button onClick={() => setUser(null)} className="text-xs font-bold" style={{ color: C.primary }}>Change</button>
            </div>
            <label className="block text-xs font-bold" style={{ color: C.muted }}>Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none" style={field} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-bold" style={{ color: C.muted }}>Vehicle type
                <select value={type} onChange={(e) => setType(e.target.value)} className="mt-1 w-full rounded-xl px-3 py-3 text-sm outline-none" style={field}>
                  {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block text-xs font-bold" style={{ color: C.muted }}>Vehicle number
                <input value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="BA 12 PA 1234" maxLength={40} className="mt-1 w-full rounded-xl px-3 py-3 text-sm outline-none" style={field} />
              </label>
            </div>
            <p className="text-[11px]" style={{ color: C.muted }}>This gives the user the Delivery role. No new account or password is created.</p>
            {formError && <p className="text-xs font-bold" role="alert" style={{ color: "#B3261E" }}>{formError}</p>}
            <PillButton full disabled={busy} onClick={submit}>{busy ? "Creating…" : "Create rider"}</PillButton>
          </>
        )}
      </div>
    </Sheet>
  );
}
