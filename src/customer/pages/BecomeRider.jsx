import React, { useCallback, useEffect, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, InlineNotice, Spinner, ErrorState } from "../../components/shared/ui.jsx";
import { FileUpload } from "../../components/shared/FileUpload.jsx";
import { riderApplicationsApi } from "../../services/api/riderApplicationsApi.js";
import { VEHICLE_TYPES } from "../../services/api/deliveryApi.js";
import { canUseRiderApp } from "../../services/access.js";
import { applicationView, buildApplicationBody, isBicycle, requiredDocuments, validateApplication } from "../../delivery/riderApplication.js";
import { TONE } from "../../theme.js";

const BLANK = { phone: "", vehicleType: VEHICLE_TYPES[0], vehicleNumber: "", licenseNumber: "", files: {} };

/* Apply to become a delivery rider. Submitting creates a PENDING application only — nothing changes about this account
   until a reviewer approves it. Documents go to private storage and are visible only to you and reviewers. */
export default function BecomeRider({ nav }) {
  const C = useC();
  const { session, toast } = useApp();
  const [apps, setApps] = useState(null);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false); // "start a new application" after a final decline
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try { const list = await riderApplicationsApi.mine(); if (seq === loadSeq.current) { setApps(list); setError(""); } }
    catch (err) { if (seq === loadSeq.current) setError(err.message || "Couldn't load your application"); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const header = <PageHeader title="Become a rider" onBack={() => nav("profile")} />;
  if (!session.signedIn) return <Page>{header}<InlineNotice tone="info">Sign in to apply.</InlineNotice></Page>;
  if (apps === null && !error) return <Page>{header}<div className="py-16 flex justify-center"><Spinner size={26} /></div></Page>;
  if (apps === null) return <Page>{header}<ErrorState title="Couldn't load" message={error} onRetry={load} /></Page>;

  const latest = apps[0] || null;
  const view = starting ? "form" : applicationView(latest);

  return (
    <Page>
      {header}
      <div className="px-4 md:px-0 space-y-3">
        {view === "review" && <Status tone="info" title="Application under review" text="A reviewer is checking your documents. You'll get a notification when there's a decision — usually within a few days." />}
        {view === "approved" && (
          <>
            <Status tone="ok" title="You're approved" text={canUseRiderApp(session) ? "Open the Delivery App and switch to Available to start taking deliveries." : "Sign out and back in to activate your rider access, then open the Delivery App from your profile."} />
            {canUseRiderApp(session) && <PillButton full onClick={() => nav("delivery")}>Open Delivery App</PillButton>}
          </>
        )}
        {view === "declined" && (
          <>
            <Status tone="danger" title="Application not approved" text={latest.rejectionReason || "Your application wasn't approved."} />
            <PillButton full variant="outline" onClick={() => setStarting(true)}>Start a new application</PillButton>
          </>
        )}
        {view === "fix" && <Status tone="warn" title="Changes needed" text={latest.rejectionReason || "Please update your application and send it again."} />}
        {(view === "form" || view === "fix") && (
          <ApplicationForm key={latest?.id + view} existing={view === "fix" ? latest : null}
            onSubmitted={async (msg) => { toast(msg); setStarting(false); await load(); }} />
        )}
        <p className="text-[11px] px-1" style={{ color: C.muted }}>Your documents are stored privately and seen only by you and the people who review rider applications.</p>
      </div>
    </Page>
  );
}

function Status({ tone, title, text }) {
  const C = useC();
  const color = { ok: TONE.ok, danger: TONE.danger, warn: TONE.warn, info: C.primary }[tone] || C.navy;
  return (
    <div className="rounded-2xl p-4" role="status" style={{ background: C.white, border: `1.5px solid ${color}` }}>
      <p className="font-bold text-sm" style={{ color }}>{title}</p>
      <p className="text-xs mt-1" style={{ color: C.muted }}>{text}</p>
    </div>
  );
}

function ApplicationForm({ existing, onSubmitted }) {
  const C = useC();
  const { session } = useApp();
  const [form, setForm] = useState({ ...BLANK, phone: existing?.phone || session.user?.phone || "", vehicleType: existing?.vehicleType || BLANK.vehicleType, vehicleNumber: existing?.vehicleNumber || "" });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const setFile = (type, value) => { setForm((f) => ({ ...f, files: { ...f.files, [type]: value } })); setErrors((e) => ({ ...e, [type]: undefined })); };
  const field = { background: C.white, border: `1px solid ${C.border}`, color: C.navy };
  const bicycle = isBicycle(form.vehicleType);

  const submit = async () => {
    if (inFlight.current) return; // a double-tap must not submit (and upload) twice
    const problems = validateApplication(form);
    setErrors(problems);
    if (Object.keys(problems).length) { setFormError("Please fix the highlighted fields."); return; }
    inFlight.current = true; setBusy(true); setFormError("");
    try {
      const body = buildApplicationBody(form);
      if (existing) await riderApplicationsApi.resubmit(existing.id, body); else await riderApplicationsApi.submit(body);
      await onSubmitted(existing ? "Application sent again" : "Application submitted");
    } catch (err) { setFormError(err.message || "Couldn't send your application"); }
    finally { inFlight.current = false; setBusy(false); }
  };

  const Err = ({ k }) => (errors[k] ? <span className="block text-[11px] mt-1" role="alert" style={{ color: TONE.danger }}>{errors[k]}</span> : null);

  return (
    <div className="rounded-2xl p-4 space-y-3" style={{ background: C.bg }}>
      {existing && <p className="text-xs" style={{ color: C.muted }}>For your safety, please upload your documents again.</p>}
      <label className="block text-xs font-bold" style={{ color: C.muted }}>Mobile number
        <input value={form.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" placeholder="98XXXXXXXX" className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none" style={field} />
        <Err k="phone" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs font-bold" style={{ color: C.muted }}>Vehicle
          <select value={form.vehicleType} onChange={(e) => set({ vehicleType: e.target.value })} className="mt-1 w-full rounded-xl px-3 py-3 text-sm outline-none" style={field}>
            {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        {!bicycle && (
          <label className="block text-xs font-bold" style={{ color: C.muted }}>Vehicle number
            <input value={form.vehicleNumber} onChange={(e) => set({ vehicleNumber: e.target.value })} placeholder="BA 12 PA 1234" maxLength={40} className="mt-1 w-full rounded-xl px-3 py-3 text-sm outline-none" style={field} />
            <Err k="vehicleNumber" />
          </label>
        )}
      </div>
      {!bicycle && (
        <label className="block text-xs font-bold" style={{ color: C.muted }}>Driving licence number
          <input value={form.licenseNumber} onChange={(e) => set({ licenseNumber: e.target.value })} maxLength={40} className="mt-1 w-full rounded-xl px-4 py-3 text-sm outline-none" style={field} />
          <Err k="licenseNumber" />
        </label>
      )}
      {requiredDocuments(form.vehicleType).map((d) => (
        <div key={d.type}><FileUpload label={d.label} required value={form.files[d.type]} onChange={(v) => setFile(d.type, v)} /><Err k={d.type} /></div>
      ))}
      {!bicycle && <FileUpload label="Government ID (optional)" value={form.files.citizen_id} onChange={(v) => setFile("citizen_id", v)} />}
      {formError && <p className="text-xs font-bold" role="alert" style={{ color: TONE.danger }}>{formError}</p>}
      <PillButton full disabled={busy} onClick={submit}>{busy ? "Sending…" : existing ? "Send again" : "Submit application"}</PillButton>
    </div>
  );
}
