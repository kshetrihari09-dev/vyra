import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Badge, EmptyState, ErrorState, PillButton, Sheet, Spinner } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";
import { riderApplicationsApi } from "../services/api/riderApplicationsApi.js";
import { TONE } from "../theme.js";

const TABS = [{ id: "under_review", label: "Pending" }, { id: "approved", label: "Approved" }, { id: "rejected", label: "Declined" }];
const STATUS = { under_review: { label: "Pending", tone: "warn" }, approved: { label: "Approved", tone: "ok" }, rejected: { label: "Declined", tone: "danger" } };
const DOC_LABEL = { driving_license: "Driving licence", vehicle_registration: "Vehicle registration", citizen_id: "Government ID", insurance: "Insurance", other: "Other" };
const date = (iso) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "");

/* Review queue for rider applications. Approving runs the same code as adding a rider directly (delivery role + profile).
   Shown only to people who hold both delivery:manage and roles:assign — the server enforces it again on every call. */
export default function RiderApplications({ onApproved }) {
  const C = useC();
  const [tab, setTab] = useState("under_review");
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(null);
  const seq = useRef(0);

  const load = useCallback(async () => {
    const s = ++seq.current; // drop a slower response from a tab we've already left
    setApps(null);
    try { const list = await riderApplicationsApi.all(tab); if (s === seq.current) { setApps(list); setError(""); } }
    catch (err) { if (s === seq.current) setError(err.message || "Couldn't load applications"); }
  }, [tab]);
  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="flex gap-2 mb-3 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold"
            style={{ background: tab === t.id ? C.primary : C.white, color: tab === t.id ? "#fff" : C.navy, border: `1px solid ${tab === t.id ? C.primary : C.border}` }}>{t.label}</button>
        ))}
      </div>
      {error ? <ErrorState title="Couldn't load applications" message={error} onRetry={load} />
        : apps === null ? <div className="py-12 flex justify-center"><Spinner size={24} /></div>
        : apps.length === 0 ? <EmptyState icon={() => <Icon name="Bike" size={26} />} title="Nothing here" message={tab === "under_review" ? "New rider applications will appear here for review." : "No applications in this list."} />
        : (
          <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            {apps.map((a, i) => (
              <button key={a.id} onClick={() => setOpen(a)} className="w-full text-left p-4 flex items-center gap-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate" style={{ color: C.navy }}>{a.applicant.name}</span>
                  <span className="block text-[11px]" style={{ color: C.muted }}>{[a.vehicleType, a.vehicleNumber].filter(Boolean).join(" · ")} · {a.phone}</span>
                  <span className="block text-[11px]" style={{ color: C.muted }}>Applied {date(a.createdAt)} · {a.documents.length} document{a.documents.length === 1 ? "" : "s"}</span>
                </span>
                <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
              </button>
            ))}
          </div>
        )}
      <ReviewSheet app={open} onClose={() => setOpen(null)} onDecided={async (approved) => { setOpen(null); await load(); if (approved) onApproved?.(); }} />
    </div>
  );
}

function ReviewSheet({ app, onClose, onDecided }) {
  const C = useC();
  const { toast } = useApp();
  const [full, setFull] = useState(null);   // the single-application view carries the full licence number
  const [reason, setReason] = useState("");
  const [mode, setMode] = useState(null);   // null | "request_correction" | "reject"
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);

  useEffect(() => {
    setFull(null); setReason(""); setMode(null);
    if (!app) return undefined;
    let live = true;
    riderApplicationsApi.get(app.id).then((a) => { if (live) setFull(a); }).catch(() => {});
    return () => { live = false; };
  }, [app?.id]);
  if (!app) return null;
  const view = full || app;
  const pending = view.status === "under_review";

  const viewDoc = async (doc) => {
    try { const url = await riderApplicationsApi.documentBlobUrl(app.id, doc.id); window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60_000); }
    catch (err) { toast(err.message || "Couldn't open that document", "danger"); }
  };
  const decide = async (decision) => {
    if (inFlight.current) return; // one decision per click: a double-tap must not approve twice
    if (decision !== "approve" && !reason.trim()) { toast("Add a reason for the applicant", "danger"); return; }
    inFlight.current = true; setBusy(true);
    try {
      await riderApplicationsApi.decide(app.id, decision, reason.trim());
      toast(decision === "approve" ? `${view.applicant.name} is now a rider` : decision === "reject" ? "Application declined" : "Changes requested");
      await onDecided(decision === "approve");
    } catch (err) { toast(err.message || "Couldn't save that decision", "danger"); }
    finally { inFlight.current = false; setBusy(false); }
  };

  return (
    <Sheet open onClose={onClose} title="Rider application">
      <div className="space-y-3">
        <div className="rounded-xl p-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="text-sm font-bold" style={{ color: C.navy }}>{view.applicant.name}</p>
          <p className="text-[11px]" style={{ color: C.muted }}>{view.applicant.email}</p>
          <p className="text-xs mt-2" style={{ color: C.navy }}>Phone: {view.phone}</p>
          <p className="text-xs" style={{ color: C.navy }}>Vehicle: {[view.vehicleType, view.vehicleNumber].filter(Boolean).join(" · ")}</p>
          {view.licenseNumber && <p className="text-xs" style={{ color: C.navy }}>Licence no.: {view.licenseNumber}</p>}
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Documents</p>
          {view.documents.map((d) => (
            <button key={d.id} onClick={() => viewDoc(d)} className="w-full flex items-center justify-between rounded-xl px-4 py-2.5 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span><span className="block text-sm font-bold" style={{ color: C.navy }}>{DOC_LABEL[d.type] || d.type}</span><span className="block text-[11px]" style={{ color: C.muted }}>{d.fileName}</span></span>
              <span className="text-xs font-bold" style={{ color: C.primary }}>View</span>
            </button>
          ))}
        </div>
        {view.rejectionReason && !pending && <p className="text-xs rounded-xl p-3" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.muted }}>Reason given: {view.rejectionReason}</p>}
        {pending && (mode ? (
          <>
            <label className="block text-xs font-bold" style={{ color: C.muted }}>{mode === "reject" ? "Reason for declining" : "What needs to change?"}
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500} className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
            </label>
            <PillButton full variant={mode === "reject" ? "danger" : "primary"} disabled={busy} onClick={() => decide(mode)}>{busy ? "Saving…" : mode === "reject" ? "Decline application" : "Send back for changes"}</PillButton>
            <PillButton full variant="subtle" disabled={busy} onClick={() => { setMode(null); setReason(""); }}>Back</PillButton>
          </>
        ) : (
          <div className="space-y-2">
            <PillButton full disabled={busy} onClick={() => decide("approve")}>{busy ? "Approving…" : "Approve and make a rider"}</PillButton>
            <PillButton full variant="outline" disabled={busy} onClick={() => setMode("request_correction")}>Request changes</PillButton>
            <button disabled={busy} onClick={() => setMode("reject")} className="w-full text-xs font-bold py-2" style={{ color: TONE.danger }}>Decline</button>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
