import React, { useMemo, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, Sheet, InlineNotice, EmptyState } from "../components/shared/ui.jsx";
import { Icon, FileText, Check, X, Stethoscope } from "../components/shared/Icon.jsx";
import { dateTimeLabel, fmt } from "../utils/format.js";
import { expiringSoon, expiredBatches } from "../utils/inventory.js";
import { TONE } from "../theme.js";

const TABS = [
  { id: "pending", label: "Awaiting review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

/** Pharmacist console — the only place prescriptions are approved or rejected. */
export default function Prescriptions({ nav }) {
  const { prescriptions, products, orders, storeId, dispatch, toast, session } = useApp();
  const C = useC();
  const [tab, setTab] = useState("pending");
  const [review, setReview] = useState(null);
  const [notes, setNotes] = useState("");

  const rows = prescriptions.filter((r) => r.status === tab);

  const kpis = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todaysOrders = orders.filter((o) => (o.placedAt || "").slice(0, 10) === todayKey);
    const todaysSales = todaysOrders.filter((o) => !["cancelled", "returned"].includes(o.status)).reduce((s, o) => s + o.totals.total, 0);
    const lowStock = products.filter((p) => {
      const q = p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock?.[storeId] || 0), 0) : (p.stock?.[storeId] || 0);
      return q > 0 && q <= 10;
    }).length;
    const expiring = products.filter((p) => expiringSoon(p, 90).length > 0).length;
    const expired = products.filter((p) => expiredBatches(p).length > 0).length;
    const pendingDispensing = prescriptions.filter((r) => r.status === "approved").length;
    return {
      pending: prescriptions.filter((r) => r.status === "pending").length,
      approved: prescriptions.filter((r) => r.status === "approved").length,
      rejected: prescriptions.filter((r) => r.status === "rejected").length,
      lowStock, expiring, expired,
      todaysOrders: todaysOrders.length, pendingDispensing, todaysSales,
    };
  }, [prescriptions, products, orders, storeId]);

  const decide = (status) => {
    dispatch({ type: "RX_DECIDE", id: review.id, status, notes: notes || (status === "approved" ? "Verified against the prescription on file." : "Prescription unclear or expired."), pharmacist: "Dr. N. Rao" });
    dispatch({ type: "AUDIT", entry: { actor: "Dr. N. Rao (Pharmacist)", action: `Prescription ${status}`, detail: `${review.id} for ${review.customer}` } });
    dispatch({ type: "NOTIFY_ADD", notification: { id: `n${Date.now()}`, kind: "prescription", title: status === "approved" ? "Prescription approved" : "Prescription rejected", message: status === "approved" ? "Your medicines can now be dispensed." : "Please upload a clearer or more recent prescription.", time: "just now", unread: true } });
    setReview(null); setNotes("");
    toast(`Prescription ${status}`);
  };

  return (
    <Page>
      <PageHeader title="Pharmacist Console" subtitle="Verify prescriptions before dispensing" onBack={() => nav("profile")} />
      <div className="px-4 md:px-0">
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2.5 mb-4">
          {[
            { label: "Pending Rx", value: kpis.pending, icon: "FileText", tone: TONE.warn },
            { label: "Ready to dispense", value: kpis.pendingDispensing, icon: "PackageCheck", tone: TONE.ok },
            { label: "Today's orders", value: kpis.todaysOrders, icon: "Package", tone: TONE.info },
            { label: "Today's sales", value: fmt(kpis.todaysSales), icon: "TrendingUp", tone: C.primary },
            { label: "Low stock", value: kpis.lowStock, icon: "AlertTriangle", tone: TONE.warn },
            { label: "Expiring soon", value: kpis.expiring, icon: "Clock", tone: TONE.warn },
            { label: "Expired stock", value: kpis.expired, icon: "AlertTriangle", tone: TONE.danger },
            { label: "Rejected Rx", value: kpis.rejected, icon: "X", tone: TONE.danger },
          ].map((k) => (
            <div key={k.label} className="rounded-2xl p-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-7 h-7 rounded-lg flex items-center justify-center mb-1.5" style={{ background: k.tone + "18" }}>
                <Icon name={k.icon} size={13} style={{ color: k.tone }} />
              </span>
              <p className="font-extrabold text-base" style={{ color: C.navy }}>{k.value}</p>
              <p className="text-[10px] leading-tight" style={{ color: C.muted }}>{k.label}</p>
            </div>
          ))}
        </div>

        <InlineNotice tone="info" icon={Stethoscope}>
          Only a licensed pharmacist can approve a prescription. Every decision is written to the audit log with your name.
        </InlineNotice>

        <div className="flex gap-2 my-4">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className="px-3.5 py-2 rounded-full text-xs font-bold"
              style={{ background: tab === t.id ? C.primary : C.white, color: tab === t.id ? "#fff" : C.navy, border: `1px solid ${tab === t.id ? C.primary : C.border}` }}>
              {t.label} ({prescriptions.filter((r) => r.status === t.id).length})
            </button>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState icon={FileText} title="Nothing here" message={tab === "pending" ? "No prescriptions are waiting for review." : `No ${tab} prescriptions.`} />
        ) : (
          <div className="space-y-3">
            {rows.map((rx) => (
              <div key={rx.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <div className="flex items-center gap-3">
                  <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                    <FileText size={18} style={{ color: C.primary }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm" style={{ color: C.navy }}>{rx.customer}</p>
                    <p className="text-[11px] truncate" style={{ color: C.muted }}>{rx.id} · {rx.fileName} · {dateTimeLabel(rx.uploadedAt)}</p>
                  </div>
                  <Badge tone={rx.status === "approved" ? "ok" : rx.status === "rejected" ? "danger" : "warn"}>{rx.status}</Badge>
                </div>

                <div className="mt-3 rounded-xl p-3" style={{ background: C.bg }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide mb-1" style={{ color: C.muted }}>Requested medicines</p>
                  {rx.items.map((id) => {
                    const p = products.find((x) => x.id === id);
                    return p ? (
                      <p key={id} className="text-xs" style={{ color: C.navy }}>
                        • {p.name} — {p.attributes?.strength || ""} {p.attributes?.dosageForm || ""}
                      </p>
                    ) : null;
                  })}
                </div>

                {rx.notes && <p className="text-xs mt-2" style={{ color: C.muted }}><span className="font-bold" style={{ color: C.navy }}>{rx.pharmacist}:</span> {rx.notes}</p>}

                {rx.status === "pending" && (
                  <div className="flex gap-2 mt-3">
                    <PillButton size="sm" variant="danger" className="flex-1" onClick={() => { setReview(rx); setNotes(""); }}>Review</PillButton>
                    <PillButton size="sm" className="flex-1" onClick={() => { setReview(rx); setNotes(""); }}><Check size={13} /> Decide</PillButton>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!review} onClose={() => setReview(null)} title="Pharmacist review"
        footer={
          <div className="flex gap-3">
            <PillButton variant="danger" className="flex-1" onClick={() => decide("rejected")}><X size={14} /> Reject</PillButton>
            <PillButton className="flex-1" onClick={() => decide("approved")}><Check size={14} /> Approve</PillButton>
          </div>
        }>
        {review && (
          <>
            <div className="rounded-2xl h-40 flex items-center justify-center mb-4" style={{ background: C.mint }}>
              <div className="text-center">
                <FileText size={30} style={{ color: C.primary }} className="mx-auto mb-2" />
                <p className="text-xs font-bold" style={{ color: C.navy }}>{review.fileName}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>Uploaded {dateTimeLabel(review.uploadedAt)}</p>
              </div>
            </div>
            <p className="text-sm mb-3" style={{ color: C.muted }}>
              Check the prescriber's details, the date, and that the dose matches what's being dispensed.
            </p>
            <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Pharmacist notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Visible to the customer with your decision"
              className="w-full mt-1 rounded-2xl p-3 text-sm outline-none resize-none"
              style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
          </>
        )}
      </Sheet>
    </Page>
  );
}
