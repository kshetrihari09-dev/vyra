import React, { useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, InlineNotice, EmptyState, Divider } from "../../components/shared/ui.jsx";
import { FileText, Upload, ShieldCheck, Clock, Check, X, MessageCircle } from "../../components/shared/Icon.jsx";
import { dateTimeLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const ACCEPTED = "image/jpeg,image/png,application/pdf";

const STATUS = {
  pending: { tone: "warn", label: "Awaiting pharmacist", icon: Clock },
  approved: { tone: "ok", label: "Approved", icon: Check },
  rejected: { tone: "danger", label: "Rejected", icon: X },
};

/** Prescription is a category module — it only ever appears for products whose
    category declares it, never for groceries or electronics. */
export default function Prescription({ nav, params }) {
  const { prescriptions, products, commerce, dispatch, toast } = useApp();
  const C = useC();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const product = params.productId ? products.find((p) => p.id === params.productId) : null;

  const pickFile = () => fileInputRef.current?.click();

  const onFileChosen = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be picked again later
    if (!file) return;
    setUploading(true);
    try {
      await commerce.uploadPrescription(file, { productIds: product ? [product.id] : undefined });
      dispatch({ type: "NOTIFY_ADD", notification: { id: `n${Date.now()}`, kind: "prescription", title: "Prescription received", message: "A pharmacist will review it within 30 minutes.", time: "just now", unread: true } });
      toast("Prescription uploaded for review");
    } catch (err) {
      toast(err.message || "Couldn't upload that file — try again");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Prescriptions" subtitle="Uploads and pharmacist decisions" onBack={() => nav(product ? "product" : "profile", product ? { productId: product.id } : {})} />

      <div className="px-4 md:px-0 space-y-4">
        {product && (
          <InlineNotice tone="info" icon={ShieldCheck}>
            You're uploading for <span className="font-bold">{product.name}</span>. It can't be dispensed until a pharmacist approves it.
          </InlineNotice>
        )}

        <div className="rounded-2xl p-5 text-center" style={{ background: C.white, border: `1.5px dashed ${C.primary}` }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: C.mint }}>
            <Upload size={22} style={{ color: C.primary }} />
          </span>
          <p className="font-bold text-sm" style={{ color: C.navy }}>Upload your prescription</p>
          <p className="text-xs mt-1 mb-4" style={{ color: C.muted }}>
            A clear photo or PDF showing the doctor's name, registration number, date and your name.
          </p>
          <input ref={fileInputRef} type="file" accept={ACCEPTED} onChange={onFileChosen} className="hidden" />
          <PillButton onClick={pickFile} disabled={uploading}>{uploading ? "Uploading…" : "Choose file"}</PillButton>
          <p className="text-[11px] mt-3" style={{ color: C.muted }}>JPG, PNG or PDF · up to 10 MB</p>
        </div>

        <div className="rounded-2xl p-4" style={{ background: C.mint }}>
          <p className="text-xs font-bold mb-2" style={{ color: C.primary }}>How verification works</p>
          {[
            "You upload a prescription, or add one at checkout.",
            "A licensed pharmacist checks the medicine, dose and validity.",
            "Approved orders are dispensed and dispatched; rejected ones are refunded in full.",
          ].map((s, i) => (
            <div key={i} className="flex gap-2.5 items-start mb-1.5 last:mb-0">
              <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5" style={{ background: C.primary, color: "#fff" }}>{i + 1}</span>
              <span className="text-xs" style={{ color: C.navy }}>{s}</span>
            </div>
          ))}
        </div>

        <div>
          <h2 className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Your prescriptions</h2>
          {prescriptions.length === 0 ? (
            <EmptyState icon={FileText} title="Nothing uploaded yet" message="Prescriptions you upload are stored here for reuse." />
          ) : (
            <div className="space-y-3">
              {prescriptions.map((rx) => {
                const s = STATUS[rx.status];
                const Ico = s.icon;
                return (
                  <div key={rx.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                    <div className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                        <FileText size={17} style={{ color: C.primary }} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{rx.fileName}</p>
                        <p className="text-[11px]" style={{ color: C.muted }}>{dateTimeLabel(rx.uploadedAt)}</p>
                      </div>
                      <Badge tone={s.tone}><Ico size={10} /> {s.label}</Badge>
                    </div>
                    {rx.items?.length > 0 && (
                      <p className="text-xs mt-2.5" style={{ color: C.muted }}>
                        For: {rx.items.map((id) => products.find((p) => p.id === id)?.name).filter(Boolean).join(", ")}
                      </p>
                    )}
                    {rx.notes && (
                      <>
                        <Divider className="my-2.5" />
                        <p className="text-xs" style={{ color: C.muted }}>
                          <span className="font-bold" style={{ color: C.navy }}>{rx.pharmacist || "Pharmacist"}:</span> {rx.notes}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button onClick={() => nav("support", { topic: "pharmacist" })} className="w-full rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.mint }}>
            <MessageCircle size={17} style={{ color: C.primary }} />
          </span>
          <span className="flex-1">
            <span className="block font-bold text-sm" style={{ color: C.navy }}>Talk to a pharmacist</span>
            <span className="block text-xs" style={{ color: C.muted }}>Questions about a medicine or a rejected prescription</span>
          </span>
        </button>
      </div>
    </Page>
  );
}
