import React, { useEffect, useMemo, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Sheet, Divider, InlineNotice, EmptyState } from "../components/shared/ui.jsx";
import { Search, Check, X, AlertTriangle, FileText, ClipboardList } from "../components/shared/Icon.jsx";
import { shopTypeById, isPharmacyType } from "../data/shopTypes.js";
import { DOCUMENT_TYPES } from "../data/documentTypes.js";
import { provinceName, districtName, municipalityName } from "../data/locations.js";
import { licenseStatus, maskAccountNumber } from "../utils/validation.js";
import { dateTimeLabel, fmt } from "../utils/format.js";

const TABS = [
  { id: "under_review", label: "Under Review" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
  { id: "suspended", label: "Suspended" },
  { id: "all", label: "All" },
];

/** Plugs into the same admin surface as the existing Sellers tab: an
    approved application here mints a real Seller record that immediately
    shows up there too. */
export default function AdminShopApplications() {
  const { shopApplications, session, dispatch, toast, commerce } = useApp();
  const C = useC();
  const [tab, setTab] = useState("under_review");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState(null);
  const [reasonFor, setReasonFor] = useState(null); // { app, decision } awaiting a typed reason
  const [reasonText, setReasonText] = useState("");
  const [docReject, setDocReject] = useState(null); // { appId, docId }

  /* The list is loaded once at sign-in; pull the latest whenever the queue is opened, on a slow poll, and when the
     tab regains focus, so applications submitted after the admin signed in show up without a full page reload. */
  useEffect(() => {
    const refresh = () => commerce.refreshShopApplications().catch((err) => console.error("[vyra] shop applications refresh failed:", err.code, err.message));
    refresh();
    const t = setInterval(refresh, 30_000);
    const onVisible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVisible); };
  }, [commerce]);

  const rows = useMemo(() => {
    const term = q.toLowerCase().trim();
    return shopApplications
      .filter((a) => tab === "all" || a.status === tab)
      .filter((a) => !term || a.shop.name.toLowerCase().includes(term) || a.owner.name.toLowerCase().includes(term))
      .sort((a, b) => new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt));
  }, [shopApplications, tab, q]);

  const decide = async (app, decision) => {
    if (["reject", "request_correction", "suspend"].includes(decision) && !reasonText.trim()) { toast("A reason is required", "danger"); return; }
    try {
      await commerce.decideShopApplication(app.id, { decision, reason: reasonText.trim() || null });
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: `Shop application ${decision}`, detail: `${app.shop.name} (${app.owner.name})` } });
      setReasonFor(null); setReasonText(""); setSelected(null);
      toast(decision === "approve" ? `${app.shop.name} approved and is now live` : `Application ${decision.replace("_", " ")}`);
    } catch (err) {
      toast(err.message || "Couldn't save that decision — try again", "danger");
    }
  };

  const verifyDoc = async (app, doc, status, reason) => {
    try {
      await commerce.verifyShopDocument(app.id, doc.id, { status, reason });
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: `Document ${status}`, detail: `${DOCUMENT_TYPES.find((d) => d.id === doc.type)?.label || doc.type} · ${app.shop.name}` } });
      setDocReject(null);
      toast(`Document ${status}`);
    } catch (err) {
      toast(err.message || "Couldn't save that — try again", "danger");
    }
  };

  /* Documents live in private storage behind the bearer-authenticated file route, so "View" fetches the bytes
     and opens a blob: URL rather than linking to a URL a browser tab couldn't authenticate against. */
  const viewDoc = async (app, doc) => {
    try {
      if (typeof doc.fileUrl === "string" && doc.fileUrl.startsWith("data:")) { window.open(doc.fileUrl, "_blank", "noopener"); return; }
      const url = await commerce.fetchShopDocument(app.id, doc.id);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      toast(err.message || "Couldn't open that document", "danger");
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className="shrink-0 px-3.5 py-2 rounded-full text-xs font-bold"
            style={{ background: tab === t.id ? C.primary : C.white, color: tab === t.id ? "#fff" : C.navy, border: `1px solid ${tab === t.id ? C.primary : C.border}` }}>
            {t.label} ({shopApplications.filter((a) => t.id === "all" || a.status === t.id).length})
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2 rounded-full px-4 h-11 mb-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <Search size={16} style={{ color: C.muted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shop or owner name"
          className="flex-1 bg-transparent outline-none text-sm" style={{ color: C.navy }} />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={ClipboardList} title="Nothing here" message="No applications match this filter." />
      ) : (
        <div className="space-y-3">
          {rows.map((app) => {
            const pharmacy = isPharmacyType(app.shop.shopType);
            const status = pharmacy ? licenseStatus(app.pharmacy?.licenseExpiryDate) : null;
            return (
              <button key={app.id} onClick={() => setSelected(app)} className="w-full text-left rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="font-bold text-sm" style={{ color: C.navy }}>{app.shop.name}</p>
                  <Badge tone={app.status === "approved" ? "ok" : app.status === "rejected" ? "danger" : app.status === "suspended" ? "neutral" : "warn"}>{app.status.replace("_", " ")}</Badge>
                </div>
                <p className="text-xs" style={{ color: C.muted }}>
                  {app.owner.name} · {shopTypeById(app.shop.shopType)?.label} · {districtName(app.shop.provinceId, app.shop.districtId)}
                </p>
                {status?.level === "expired" && <span className="inline-block mt-1.5"><Badge tone="danger"><AlertTriangle size={9} /> License expired</Badge></span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Detail sheet */}
      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selected?.shop.name || ""}>
        {selected && (
          <div className="space-y-4">
            <Badge tone={selected.status === "approved" ? "ok" : selected.status === "rejected" ? "danger" : "warn"}>{selected.status.replace("_", " ")}</Badge>

            <Section title="Owner">
              <Row label="Name" value={selected.owner.name} />
              <Row label="Mobile" value={selected.owner.mobile} />
              <Row label="Email" value={selected.owner.email || "—"} />
            </Section>

            <Section title="Shop">
              <Row label="Type" value={shopTypeById(selected.shop.shopType)?.label} />
              <Row label="Contact" value={selected.shop.contact} />
              <Row label="Address" value={`${selected.shop.address}, Ward ${selected.shop.ward}`} />
              <Row label="Location" value={`${municipalityName(selected.shop.districtId, selected.shop.municipalityId)}, ${districtName(selected.shop.provinceId, selected.shop.districtId)}, ${provinceName(selected.shop.provinceId)}`} />
            </Section>

            {isPharmacyType(selected.shop.shopType) && selected.pharmacy && (
              <Section title="Pharmacy Licensing">
                <Row label="License #" value={selected.pharmacy.licenseNumber} />
                <Row label="Expiry" value={selected.pharmacy.licenseExpiryDate} />
                {licenseStatus(selected.pharmacy.licenseExpiryDate) && (
                  <div className="mt-1">
                    <Badge tone={licenseStatus(selected.pharmacy.licenseExpiryDate).level === "expired" ? "danger" : licenseStatus(selected.pharmacy.licenseExpiryDate).level === "expiring" ? "warn" : "ok"}>
                      {licenseStatus(selected.pharmacy.licenseExpiryDate).label}
                    </Badge>
                  </div>
                )}
                <Row label="Pharmacist" value={selected.pharmacy.pharmacistName || "—"} />
              </Section>
            )}

            <Section title="Documents">
              {selected.documents.length === 0 ? (
                <p className="text-xs" style={{ color: C.muted }}>No documents uploaded.</p>
              ) : selected.documents.map((d) => (
                <div key={d.id} className="flex items-center gap-2.5 py-2" style={{ borderTop: `1px solid ${C.border}` }}>
                  <FileText size={14} style={{ color: C.muted }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: C.navy }}>{DOCUMENT_TYPES.find((t) => t.id === d.type)?.label || d.type}</p>
                    <p className="text-[10px] truncate" style={{ color: C.muted }}>{d.fileName}</p>
                  </div>
                  <button onClick={() => viewDoc(selected, d)} className="text-[11px] font-bold px-2 py-1 rounded-lg" style={{ background: C.mint, color: C.primary }}>View</button>
                  <Badge tone={d.verificationStatus === "verified" ? "ok" : d.verificationStatus === "rejected" ? "danger" : "warn"}>{d.verificationStatus}</Badge>
                  {d.verificationStatus === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => verifyDoc(selected, d, "verified")} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: C.mint }}><Check size={13} style={{ color: C.primary }} /></button>
                      <button onClick={() => setDocReject({ appId: selected.id, docId: d.id })} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#FBEAED" }}><X size={13} style={{ color: "#C6394A" }} /></button>
                    </div>
                  )}
                </div>
              ))}
            </Section>

            <Section title="Operations">
              <Row label="Delivery" value={selected.operations.deliveryAvailable ? "Available" : "Not offered"} />
              <Row label="Pickup" value={selected.operations.pickupAvailable ? "Available" : "Not offered"} />
              <Row label="Min. order" value={fmt(selected.operations.minOrderAmount)} />
            </Section>

            <Section title="Settlement">
              <Row label="Account holder" value={selected.settlement.accountHolder || "—"} />
              <Row label="Account #" value={selected.settlement.accountNumber ? maskAccountNumber(selected.settlement.accountNumber) : "—"} />
              <Row label="Wallet" value={selected.settlement.walletProvider ? `${selected.settlement.walletProvider} · ${maskAccountNumber(selected.settlement.walletNumber)}` : "—"} />
            </Section>

            <Section title="History">
              {selected.history.slice().reverse().map((h, i) => (
                <p key={i} className="text-[11px] py-1" style={{ color: C.muted }}>
                  <span className="font-semibold capitalize" style={{ color: C.navy }}>{h.status.replace("_", " ")}</span> — {h.note} · {h.actor} · {dateTimeLabel(h.at)}
                </p>
              ))}
            </Section>

            {["submitted", "under_review"].includes(selected.status) && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <PillButton variant="danger" onClick={() => setReasonFor({ app: selected, decision: "reject" })}>Reject</PillButton>
                <PillButton variant="outline" onClick={() => setReasonFor({ app: selected, decision: "request_correction" })}>Request changes</PillButton>
                <PillButton className="col-span-2" onClick={() => decide(selected, "approve")}><Check size={14} /> Approve Shop</PillButton>
              </div>
            )}
            {selected.status === "approved" && (
              <PillButton variant="danger" full onClick={() => setReasonFor({ app: selected, decision: "suspend" })}>Suspend Shop</PillButton>
            )}
          </div>
        )}
      </Sheet>

      {/* Reason prompt for reject / request_correction / suspend */}
      <Sheet open={!!reasonFor} onClose={() => { setReasonFor(null); setReasonText(""); }} title="Add a reason"
        footer={<PillButton full variant="danger" onClick={() => decide(reasonFor.app, reasonFor.decision)}>Confirm</PillButton>}>
        <InlineNotice tone="warn">This reason is shown to the shop owner.</InlineNotice>
        <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={4} placeholder="Explain what needs to change or why this was rejected…"
          className="w-full mt-3 rounded-2xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </Sheet>

      {/* Document rejection reason */}
      <Sheet open={!!docReject} onClose={() => setDocReject(null)} title="Reject document"
        footer={<PillButton full variant="danger" onClick={() => {
          const app = shopApplications.find((a) => a.id === docReject.appId);
          const doc = app.documents.find((d) => d.id === docReject.docId);
          verifyDoc(app, doc, "rejected", reasonText.trim() || "Document unclear or invalid.");
          setReasonText("");
        }}>Reject document</PillButton>}>
        <textarea value={reasonText} onChange={(e) => setReasonText(e.target.value)} rows={3} placeholder="Why is this document being rejected?"
          className="w-full rounded-2xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </Sheet>
    </div>
  );
}

function Section({ title, children }) {
  const C = useC();
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>{title}</p>
      {children}
    </div>
  );
}
function Row({ label, value }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      <span className="text-xs font-semibold text-right" style={{ color: C.navy }}>{value}</span>
    </div>
  );
}
