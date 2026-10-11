import React, { useEffect, useState } from "react";
import { Sheet, InlineNotice } from "../components/shared/ui.jsx";
import { AlertTriangle, FileText, Loader2 } from "../components/shared/Icon.jsx";
import { inventoryApi } from "../services/api/inventoryApi.js";
import { coversAll, oldestIssueISO, todayISO, validatePaperRx } from "./posRx.js";
import { OPS } from "./posTheme.js";

const EMPTY = { patientName: "", prescriberName: "", prescriberRegNo: "", issuedOn: "", notes: "", verified: false };
const fmtDate = (v) => { const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(); };

/**
 * Record the prescription for the prescription-only medicines in the sale. Two ways, matching the two ways it can reach the counter:
 *   Paper    — the pharmacist reads the paper prescription and confirms they checked the original (in_store).
 *   From app — the customer's prescription that a pharmacist already approved online (online); it must cover EVERY medicine in the cart.
 * Only a pharmacist can do either (the server enforces it); anyone else is told so. Nothing is sent until the sale is completed.
 */
export function PrescriptionSheet({ open, onClose, rxIds, nameById, current, canVerify, onSave, error }) {
  const [tab, setTab] = useState("paper");
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [apps, setApps] = useState({ state: "idle", items: [], error: null });
  const [pick, setPick] = useState(null);
  const [confirmOwner, setConfirmOwner] = useState(false);
  const names = rxIds.map((id) => nameById.get(id) || id);

  useEffect(() => { // every time it opens: start from what's attached (if any), with the date defaulting to today
    if (!open) return;
    const paper = current?.payload.source === "in_store" ? current.payload : null;
    setForm(paper ? { ...EMPTY, ...paper, prescriberRegNo: paper.prescriberRegNo || "", notes: paper.notes || "", verified: false } : { ...EMPTY, issuedOn: todayISO() });
    setErrors({}); setPick(null); setConfirmOwner(false); setTab(current?.payload.source === "online" ? "app" : "paper");
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { // the pick-list is only fetched when that tab is actually looked at
    if (!open || tab !== "app" || !canVerify || rxIds.length === 0) return undefined;
    let alive = true;
    setApps({ state: "loading", items: [], error: null });
    inventoryApi.posPrescriptions(rxIds).then((items) => alive && setApps({ state: "ready", items, error: null }))
      .catch(() => alive && setApps({ state: "error", items: [], error: "Couldn't load prescriptions. Check the connection and try again." }));
    return () => { alive = false; };
  }, [open, tab, canVerify, rxIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const savePaper = () => {
    const r = validatePaperRx(form);
    if (!r.ok) { setErrors(r.errors); return; }
    const p = r.prescription;
    onSave({ payload: p, summary: { patientName: p.patientName, prescriberName: p.prescriberName, prescriberRegNo: p.prescriberRegNo, issuedOn: p.issuedOn } });
  };
  const saveApp = () => {
    const it = apps.items.find((x) => x.id === pick); if (!it || !confirmOwner) return;
    onSave({ payload: { source: "online", prescriptionId: it.id, verified: true }, summary: { customerName: it.customerName, approvedOn: fmtDate(it.approvedAt), items: it.items } });
  };

  const field = (id, label, { fk = id, ...props } = {}, hint) => ( // `fk` = which form field this edits (a prop named `key` would collide with React's)
    <div className="mb-3">
      <label htmlFor={id} className="text-[11px] font-bold uppercase tracking-wide block mb-1" style={{ color: OPS.sub }}>{label}</label>
      <input id={id} value={form[fk]} onChange={(e) => set(fk, e.target.value)} aria-invalid={!!errors[fk]} autoComplete="off"
        className="w-full rounded-lg px-3 h-11 text-sm outline-none" style={{ background: OPS.surface, border: `1.5px solid ${errors[fk] ? OPS.danger : OPS.line}`, color: OPS.ink }} {...props} />
      {errors[fk] && <p className="text-xs mt-1" role="alert" style={{ color: OPS.danger }}>{errors[fk]}</p>}
      {hint && !errors[fk] && <p className="text-[11px] mt-1" style={{ color: OPS.sub }}>{hint}</p>}
    </div>
  );
  const tabBtn = (id, label) => (
    <button key={id} onClick={() => setTab(id)} aria-pressed={tab === id} className="flex-1 py-2 text-xs font-bold rounded-lg"
      style={{ background: tab === id ? OPS.blueBg : OPS.surface, color: tab === id ? OPS.blue : OPS.sub, border: `1.5px solid ${tab === id ? OPS.blue : OPS.line}` }}>{label}</button>
  );

  return (
    <Sheet open={open} onClose={onClose} title="Prescription"
      footer={canVerify && (tab === "paper"
        ? <button onClick={savePaper} className="w-full rounded-lg py-3 font-bold text-sm" style={{ background: OPS.blue, color: "#fff" }}>Use this prescription</button>
        : <button onClick={saveApp} disabled={!pick || !confirmOwner} className="w-full rounded-lg py-3 font-bold text-sm disabled:opacity-40" style={{ background: OPS.blue, color: "#fff" }}>Use selected prescription</button>)}>
      {error && <div className="mb-3"><InlineNotice tone="danger" icon={AlertTriangle}>{error}</InlineNotice></div>}
      <div className="rounded-lg p-3 mb-4 flex gap-2.5" style={{ background: OPS.warnBg }}>
        <FileText size={16} style={{ color: OPS.warn, flexShrink: 0, marginTop: 2 }} />
        <p className="text-sm" style={{ color: OPS.ink }}><b>Prescription required for:</b> {names.join(", ")}</p>
      </div>

      {!canVerify ? (
        <InlineNotice tone="warn" icon={AlertTriangle}>Only a pharmacist can verify a prescription and dispense these medicines. Please ask a pharmacist to complete this sale.</InlineNotice>
      ) : (
        <>
          <div className="flex gap-2 mb-4">{tabBtn("paper", "Paper prescription")}{tabBtn("app", "Approved in the app")}</div>

          {tab === "paper" ? (
            <div>
              {field("rx-patient", "Patient name", { fk: "patientName", placeholder: "As written on the prescription", maxLength: 100, autoFocus: true })}
              {field("rx-prescriber", "Prescriber (doctor)", { fk: "prescriberName", placeholder: "Dr. …", maxLength: 100 })}
              {field("rx-reg", "Prescriber registration no. (optional)", { fk: "prescriberRegNo", maxLength: 40 })}
              {field("rx-date", "Date issued", { fk: "issuedOn", type: "date", min: oldestIssueISO(), max: todayISO() }, "Prescriptions older than 180 days can't be dispensed against.")}
              {field("rx-notes", "Notes (optional)", { fk: "notes", maxLength: 300 })}
              <label className="flex items-start gap-2.5 mt-1 cursor-pointer">
                <input type="checkbox" checked={form.verified} onChange={(e) => set("verified", e.target.checked)} className="mt-0.5 w-4 h-4" aria-invalid={!!errors.verified} />
                <span className="text-sm" style={{ color: OPS.ink }}>I have checked the original prescription, and it covers the medicines being sold.</span>
              </label>
              {errors.verified && <p className="text-xs mt-1" role="alert" style={{ color: OPS.danger }}>{errors.verified}</p>}
            </div>
          ) : (
            <div>
              {apps.state === "loading" && <p className="text-sm flex items-center gap-2" style={{ color: OPS.sub }}><Loader2 size={14} className="animate-spin" /> Loading prescriptions…</p>}
              {apps.state === "error" && <InlineNotice tone="danger" icon={AlertTriangle}>{apps.error}</InlineNotice>}
              {apps.state === "ready" && apps.items.length === 0 && <p className="text-sm py-6 text-center" style={{ color: OPS.sub }}>No approved prescriptions in the app cover these medicines. Use the paper prescription instead.</p>}
              <div className="space-y-2" role="radiogroup" aria-label="Approved prescriptions">
                {apps.items.map((it) => {
                  const covers = coversAll(it.items, rxIds); const missing = rxIds.filter((id) => !it.items.includes(id)).map((id) => nameById.get(id) || id);
                  return (
                    <button key={it.id} role="radio" aria-checked={pick === it.id} disabled={!covers} onClick={() => setPick(it.id)} className="w-full text-left rounded-lg p-3 disabled:opacity-50"
                      style={{ background: pick === it.id ? OPS.blueBg : OPS.surface, border: `1.5px solid ${pick === it.id ? OPS.blue : OPS.line}` }}>
                      <p className="text-sm font-bold" style={{ color: OPS.ink }}>{it.customerName}</p>
                      <p className="text-[11px]" style={{ color: OPS.sub }}>Approved {fmtDate(it.approvedAt)} · covers {it.items.map((id) => nameById.get(id) || id).join(", ")}</p>
                      {!covers && <p className="text-[11px] font-semibold mt-1" style={{ color: OPS.danger }}>Doesn't cover: {missing.join(", ")}</p>}
                      {covers && it.uses > 0 && <p className="text-[11px] font-semibold mt-1" style={{ color: OPS.warn }}>Already used {it.uses} {it.uses === 1 ? "time" : "times"}</p>}
                    </button>
                  );
                })}
              </div>
              {pick && (
                <label className="flex items-start gap-2.5 mt-4 cursor-pointer">
                  <input type="checkbox" checked={confirmOwner} onChange={(e) => setConfirmOwner(e.target.checked)} className="mt-0.5 w-4 h-4" />
                  <span className="text-sm" style={{ color: OPS.ink }}>I have confirmed this prescription belongs to the customer in front of me.</span>
                </label>
              )}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
