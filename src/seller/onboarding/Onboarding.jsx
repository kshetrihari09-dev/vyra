import React, { useEffect, useMemo, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, InlineNotice, Divider, Badge } from "../../components/shared/ui.jsx";
import { Stepper } from "../../components/shared/Stepper.jsx";
import { OtpStep } from "../../components/shared/OtpStep.jsx";
import { FileUpload } from "../../components/shared/FileUpload.jsx";
import { Check, Pencil, AlertTriangle } from "../../components/shared/Icon.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { PROVINCES, districtsFor, municipalitiesFor, provinceName, districtName, municipalityName } from "../../data/locations.js";
import { SHOP_TYPES, isPharmacyType, shopTypeById } from "../../data/shopTypes.js";
import { DOCUMENT_TYPES } from "../../data/documentTypes.js";
import { validateAccountFields, isNepalMobile, licenseStatus, maskAccountNumber } from "../../utils/validation.js";
import { blankApplication, upsertDocument, stepComplete, canSubmit, applicationChecklist, DAY_LABELS } from "../../utils/shopApplication.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const STEPS = ["Owner", "Shop", "Business", "Documents", "Operations", "Settlement", "Review"];

export default function ShopOnboarding({ nav, params }) {
  const { session, dispatch, toast, shopApplications, commerce } = useApp();
  const C = useC();
  const [step, setStep] = useState(0);
  const [furthest, setFurthest] = useState(0);

  // Resume a draft/rejected application owned by this session, or the one named in params, or start fresh.
  const [app, setApp] = useState(() => {
    const byParam = params?.applicationId ? shopApplications.find((a) => a.id === params.applicationId) : null;
    const mine = shopApplications.find((a) => (a.fromServer ? a.userId === session.user.uuid : a.owner.mobile === session.user.phone) && ["draft", "rejected"].includes(a.status));
    return byParam || mine || blankApplication(session.signedIn ? session.user : null);
  });

  const save = (next) => { setApp(next); dispatch({ type: "SHOP_APP_SAVE", application: next }); };

  const goto = (i) => { setStep(i); setFurthest((f) => Math.max(f, i)); };
  const next = () => {
    if (!stepComplete(app, STEPS[step].toLowerCase())) { toast("Fill in the required fields before continuing", "danger"); return; }
    if (step < STEPS.length - 1) goto(step + 1);
  };
  const back = () => step > 0 && goto(step - 1);

  const [submitting, setSubmitting] = useState(false);
  const submit = async () => {
    if (!canSubmit(app)) { toast("Some required sections are incomplete", "danger"); return; }
    setSubmitting(true);
    try {
      // A rejected application that already lives on the server is resubmitted in place; a local draft is a first submission.
      const saved = app.fromServer ? await commerce.resubmitShopApplication(app) : await commerce.submitShopApplication(app);
      toast("Application submitted for review");
      nav("shopStatus", { applicationId: saved.id });
    } catch (err) {
      toast(err.message || "Couldn't submit your application — try again", "danger");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Register Your Shop" subtitle="Takes about 10 minutes — you can save and come back" onBack={() => nav("welcome")} />
      <div className="px-4 md:px-0 mb-5">
        <Stepper steps={STEPS} activeIndex={step} furthestIndex={furthest} onSelect={goto} />
      </div>

      <div className="px-4 md:px-0 max-w-2xl">
        {step === 0 && <OwnerStep app={app} save={save} onDone={next} session={session} />}
        {step === 1 && <ShopStep app={app} save={save} />}
        {step === 2 && <BusinessStep app={app} save={save} />}
        {step === 3 && <DocumentsStep app={app} save={save} />}
        {step === 4 && <OperationsStep app={app} save={save} />}
        {step === 5 && <SettlementStep app={app} save={save} />}
        {step === 6 && <ReviewStep app={app} goto={goto} onSubmit={submit} submitting={submitting} />}

        {step > 0 && (
          <div className="flex gap-3 mt-6">
            <PillButton variant="subtle" className="flex-1" onClick={back}>Back</PillButton>
            {step < STEPS.length - 1 && <PillButton className="flex-1" onClick={next}>Continue</PillButton>}
          </div>
        )}
      </div>
    </Page>
  );
}

/* --------------------------------- OWNER --------------------------------- */
function OwnerStep({ app, save, onDone, session }) {
  const C = useC();
  const { auth, toast } = useApp();
  const [challenge, setChallenge] = useState(null); // { id, devHint } from POST /auth/register/start
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: app.owner.name, mobile: app.owner.mobile, email: app.owner.email, password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});
  const [otpMode, setOtpMode] = useState(false);

  if (session.signedIn && app.owner.mobileVerified) {
    return (
      <div className="space-y-4">
        <InlineNotice tone="ok" icon={Check}>You're continuing as an existing Vyra account — no need to verify again.</InlineNotice>
        <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <Row label="Name" value={app.owner.name} />
          <Row label="Mobile" value={app.owner.mobile} />
          {app.owner.email && <Row label="Email" value={app.owner.email} />}
        </div>
        <PillButton full onClick={onDone}>Continue</PillButton>
      </div>
    );
  }

  const requestCode = async () => {
    const data = await auth.registerStart({ name: form.name.trim(), mobile: form.mobile, email: form.email.trim(), password: form.password });
    setChallenge({ id: data.challengeId, devHint: !!data.devHint });
  };

  if (otpMode) {
    return (
      <OtpStep target={form.mobile} devHint={challenge?.devHint}
        onVerify={async (code) => {
          // A shop owner is a normal customer account with a shop attached — same endpoint as customer sign-up.
          await auth.registerVerify({ challengeId: challenge.id, code });
          save({ ...app, owner: { name: form.name, mobile: form.mobile, email: form.email, mobileVerified: true } });
          onDone();
        }}
        onResend={requestCode}
        onChangeNumber={() => setOtpMode(false)} />
    );
  }

  const submit = async () => {
    // Format checks here; "already registered" is decided by the server.
    const v = validateAccountFields(form, { mobiles: [], emails: [] });
    setErrors(v.errors);
    if (!v.ok) return;
    setBusy(true);
    try {
      await requestCode();
      setOtpMode(true);
    } catch (err) {
      const fields = err.fieldErrors || {};
      if (Object.keys(fields).length) setErrors(fields);
      else toast(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, placeholder, type = "text") => (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input value={form[key]} type={type} onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: null }); }} placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none"
        style={{ background: C.white, border: `1px solid ${errors[key] ? TONE.danger : C.border}`, color: C.navy }} />
      {errors[key] && <p className="text-[11px] font-semibold mt-1" style={{ color: TONE.danger }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div className="space-y-4">
      <SectionHeading title="Owner account" subtitle="This becomes your login for both shopping and managing your shop." />
      {field("name", "Owner full name *", "Sabina Karki")}
      {field("mobile", "Mobile number *", "98XXXXXXXX", "tel")}
      {field("email", "Email (optional)", "you@example.com", "email")}
      {field("password", "Password *", "••••••••", "password")}
      {field("confirmPassword", "Confirm password *", "••••••••", "password")}
      <PillButton full onClick={submit} disabled={busy}>Send verification code</PillButton>
    </div>
  );
}

/* ---------------------------------- SHOP ---------------------------------- */
function ShopStep({ app, save }) {
  const C = useC();
  const set = (patch) => save({ ...app, shop: { ...app.shop, ...patch } });
  const districts = districtsFor(app.shop.provinceId);
  const municipalities = municipalitiesFor(app.shop.districtId);

  return (
    <div className="space-y-4">
      <SectionHeading title="Shop information" subtitle="This is what customers will see once you're approved." />
      <Field label="Shop / Business Name *" value={app.shop.name} onChange={(v) => set({ name: v })} placeholder="Karki General Store" />

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Shop Type *</label>
        <div className="grid grid-cols-3 gap-2 mt-1.5">
          {SHOP_TYPES.map((t) => (
            <button key={t.id} onClick={() => set({ shopType: t.id })} className="rounded-xl p-2.5 flex flex-col items-center gap-1.5"
              style={{ background: app.shop.shopType === t.id ? C.mint : C.white, border: `1.5px solid ${app.shop.shopType === t.id ? C.primary : C.border}` }}>
              <Icon name={t.icon} size={17} style={{ color: app.shop.shopType === t.id ? C.primary : C.muted }} />
              <span className="text-[10px] font-bold text-center leading-tight" style={{ color: app.shop.shopType === t.id ? C.primary : C.navy }}>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Shop Contact Number *" value={app.shop.contact} onChange={(v) => set({ contact: v })} placeholder="98XXXXXXXX" />
        <Field label="Shop Email" value={app.shop.email} onChange={(v) => set({ email: v })} placeholder="shop@example.com" />
      </div>

      <FileUpload label="Shop Logo" value={app.shop.logo} onChange={(v) => set({ logo: v })} />
      <FileUpload label="Shop Banner" value={app.shop.banner} onChange={(v) => set({ banner: v })} />

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Shop Description</label>
        <textarea rows={3} value={app.shop.description} onChange={(e) => set({ description: e.target.value })}
          className="w-full mt-1 rounded-xl p-3 text-sm outline-none resize-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </div>

      <Divider />
      <Field label="Address *" value={app.shop.address} onChange={(v) => set({ address: v })} placeholder="Ward 4, New Road" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Province *</label>
          <select value={app.shop.provinceId} onChange={(e) => set({ provinceId: e.target.value, districtId: "", municipalityId: "" })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
            <option value="">Select province</option>
            {PROVINCES.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>District *</label>
          <select value={app.shop.districtId} onChange={(e) => set({ districtId: e.target.value, municipalityId: "" })} disabled={!app.shop.provinceId}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none disabled:opacity-50" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
            <option value="">{app.shop.provinceId ? "Select district" : "Choose province first"}</option>
            {districts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Municipality *</label>
          <select value={app.shop.municipalityId} onChange={(e) => set({ municipalityId: e.target.value })} disabled={!app.shop.districtId}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none disabled:opacity-50" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
            <option value="">{app.shop.districtId ? "Select municipality" : "Choose district first"}</option>
            {municipalities.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <Field label="Ward No. *" value={app.shop.ward} onChange={(v) => set({ ward: v })} placeholder="4" />
      </div>
      <Field label="Landmark" value={app.shop.landmark} onChange={(v) => set({ landmark: v })} placeholder="Near Basantapur" />
    </div>
  );
}

/* -------------------------------- BUSINESS -------------------------------- */
function BusinessStep({ app, save }) {
  const C = useC();
  const pharmacy = isPharmacyType(app.shop.shopType);
  const p = app.pharmacy || { licenseNumber: "", licenseIssueDate: "", licenseExpiryDate: "", pharmacistName: "", pharmacistRegNumber: "" };
  const setP = (patch) => save({ ...app, pharmacy: { ...p, ...patch } });
  const status = licenseStatus(p.licenseExpiryDate);

  if (!pharmacy) {
    return (
      <div className="space-y-4">
        <SectionHeading title="Business information" subtitle={`No additional information needed for ${shopTypeById(app.shop.shopType)?.label || "this shop type"}.`} />
        <InlineNotice tone="info">Pharmacy-specific licensing only applies to Pharmacy shops. You can continue to Documents.</InlineNotice>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionHeading title="Pharmacy licensing" subtitle="Required for all pharmacy shops before approval." />
      <Field label="Pharmacy License Number *" value={p.licenseNumber} onChange={(v) => setP({ licenseNumber: v })} placeholder="PH-2026-0001" />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>License Issue Date</label>
          <input type="date" value={p.licenseIssueDate} onChange={(e) => setP({ licenseIssueDate: e.target.value })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>License Expiry Date *</label>
          <input type="date" value={p.licenseExpiryDate} onChange={(e) => setP({ licenseExpiryDate: e.target.value })}
            className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        </div>
      </div>
      {status && (
        <InlineNotice tone={status.level === "expired" ? "danger" : status.level === "expiring" ? "warn" : "ok"} icon={AlertTriangle}>
          {status.level === "expired" ? `This license has expired — ${status.label}. It must be renewed before approval.` : status.label}
        </InlineNotice>
      )}
      <FileUpload label="Pharmacy License Document" required value={app.documents.find((d) => d.type === "pharmacy_license")}
        onChange={(meta) => save({ ...app, documents: upsertDocument(app, "pharmacy_license", meta) })} />
      <Divider />
      <Field label="Responsible Pharmacist Name" value={p.pharmacistName} onChange={(v) => setP({ pharmacistName: v })} placeholder="Dr. N. Rao" />
      <Field label="Pharmacist Registration Number" value={p.pharmacistRegNumber} onChange={(v) => setP({ pharmacistRegNumber: v })} placeholder="NP-PHM-1234" />
      <FileUpload label="Pharmacist Certificate" value={app.documents.find((d) => d.type === "pharmacist_certificate")}
        onChange={(meta) => save({ ...app, documents: upsertDocument(app, "pharmacist_certificate", meta) })} />
    </div>
  );
}

/* ------------------------------- DOCUMENTS -------------------------------- */
function DocumentsStep({ app, save }) {
  return (
    <div className="space-y-4">
      <SectionHeading title="Business documents" subtitle="Private documents — never shown publicly, only to you and Vyra admins." />
      {DOCUMENT_TYPES.map((dt) => (
        <FileUpload key={dt.id} label={dt.label} required={dt.required} value={app.documents.find((d) => d.type === dt.id)}
          onChange={(meta) => save({ ...app, documents: upsertDocument(app, dt.id, meta) })} />
      ))}
    </div>
  );
}

/* ------------------------------- OPERATIONS ------------------------------- */
function OperationsStep({ app, save }) {
  const C = useC();
  const op = app.operations;
  const set = (patch) => save({ ...app, operations: { ...op, ...patch } });
  const setDay = (day, patch) => set({ hours: { ...op.hours, [day]: { ...op.hours[day], ...patch } } });

  return (
    <div className="space-y-4">
      <SectionHeading title="Operating hours" subtitle="Set different hours for each day." />
      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        {DAY_LABELS.map((day, i) => (
          <div key={day} className="flex items-center gap-2 px-3 py-2.5" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <span className="w-10 text-xs font-bold shrink-0" style={{ color: C.navy }}>{day}</span>
            {op.hours[day].closed ? (
              <span className="flex-1 text-xs" style={{ color: C.muted }}>Closed</span>
            ) : (
              <>
                <input type="time" value={op.hours[day].open} onChange={(e) => setDay(day, { open: e.target.value })}
                  className="flex-1 rounded-lg px-2 h-9 text-xs outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }} />
                <span className="text-xs" style={{ color: C.muted }}>–</span>
                <input type="time" value={op.hours[day].close} onChange={(e) => setDay(day, { close: e.target.value })}
                  className="flex-1 rounded-lg px-2 h-9 text-xs outline-none" style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.navy }} />
              </>
            )}
            <button onClick={() => setDay(day, { closed: !op.hours[day].closed })} className="text-[10px] font-bold px-2 py-1 rounded-lg shrink-0"
              style={{ background: op.hours[day].closed ? TONE.dangerBg : C.mint, color: op.hours[day].closed ? TONE.danger : C.primary }}>
              {op.hours[day].closed ? "Closed" : "Open"}
            </button>
          </div>
        ))}
      </div>

      <Divider />
      <SectionHeading title="Delivery settings" />
      <div className="flex gap-2">
        <Toggle label="Delivery available" on={op.deliveryAvailable} onToggle={() => set({ deliveryAvailable: !op.deliveryAvailable })} />
        <Toggle label="Pickup available" on={op.pickupAvailable} onToggle={() => set({ pickupAvailable: !op.pickupAvailable })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Delivery radius (km)" value={op.deliveryRadiusKm} onChange={(v) => set({ deliveryRadiusKm: v })} />
        <NumField label="Delivery fee" value={op.deliveryFee} onChange={(v) => set({ deliveryFee: v })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField label="Free delivery above" value={op.freeDeliveryAbove} onChange={(v) => set({ freeDeliveryAbove: v })} />
        <NumField label="Minimum order amount" value={op.minOrderAmount} onChange={(v) => set({ minOrderAmount: v })} />
      </div>
      <NumField label="Estimated preparation time (minutes)" value={op.prepTimeMinutes} onChange={(v) => set({ prepTimeMinutes: v })} />
    </div>
  );
}

/* ------------------------------- SETTLEMENT ------------------------------- */
function SettlementStep({ app, save }) {
  const s = app.settlement;
  const set = (patch) => save({ ...app, settlement: { ...s, ...patch } });
  return (
    <div className="space-y-4">
      <SectionHeading title="Payment / Settlement" subtitle="Only visible to you and authorized admins — never shown to customers." />
      <InlineNotice tone="info">This information is used only to pay out your order proceeds. It is never displayed publicly.</InlineNotice>
      <Field label="Account Holder Name" value={s.accountHolder} onChange={(v) => set({ accountHolder: v })} placeholder="Sabina Karki" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Bank Name" value={s.bankName} onChange={(v) => set({ bankName: v })} placeholder="Global IME Bank" />
        <Field label="Branch" value={s.branch} onChange={(v) => set({ branch: v })} placeholder="New Road" />
      </div>
      <Field label="Account Number" value={s.accountNumber} onChange={(v) => set({ accountNumber: v })} placeholder="0123456789012" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Mobile Wallet Provider" value={s.walletProvider} onChange={(v) => set({ walletProvider: v })} placeholder="eSewa / Khalti" />
        <Field label="Wallet Number" value={s.walletNumber} onChange={(v) => set({ walletNumber: v })} placeholder="98XXXXXXXX" />
      </div>
    </div>
  );
}

/* ---------------------------------- REVIEW --------------------------------- */
function ReviewStep({ app, goto, onSubmit, submitting }) {
  const C = useC();
  const ready = canSubmit(app);
  const sections = [
    { id: "owner", i: 0, title: "Owner", rows: [["Name", app.owner.name], ["Mobile", app.owner.mobile], ["Email", app.owner.email || "—"]] },
    { id: "shop", i: 1, title: "Shop", rows: [["Name", app.shop.name], ["Type", shopTypeById(app.shop.shopType)?.label || "—"], ["Contact", app.shop.contact],
      ["Location", [municipalityName(app.shop.districtId, app.shop.municipalityId), districtName(app.shop.provinceId, app.shop.districtId), provinceName(app.shop.provinceId)].filter(Boolean).join(", ") || "—"]] },
    ...(isPharmacyType(app.shop.shopType) ? [{ id: "business", i: 2, title: "Pharmacy Licensing", rows: [["License #", app.pharmacy?.licenseNumber || "—"], ["Expires", app.pharmacy?.licenseExpiryDate || "—"]] }] : []),
    { id: "documents", i: 3, title: "Documents", rows: [["Uploaded", `${app.documents.length} document(s)`]] },
    { id: "operations", i: 4, title: "Operations", rows: [["Delivery", app.operations.deliveryAvailable ? "Yes" : "No"], ["Pickup", app.operations.pickupAvailable ? "Yes" : "No"], ["Min. order", fmt(app.operations.minOrderAmount)]] },
    { id: "settlement", i: 5, title: "Settlement", rows: [["Account holder", app.settlement.accountHolder || "—"], ["Account #", app.settlement.accountNumber ? maskAccountNumber(app.settlement.accountNumber) : "—"]] },
  ];

  return (
    <div className="space-y-4">
      <SectionHeading title="Review your application" subtitle="Check everything before submitting for admin verification." />
      {sections.map((s) => (
        <div key={s.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm flex items-center gap-1.5" style={{ color: C.navy }}>
              {stepComplete(app, s.id) ? <Check size={14} style={{ color: TONE.ok }} /> : <AlertTriangle size={14} style={{ color: TONE.warn }} />} {s.title}
            </span>
            <button onClick={() => goto(s.i)} className="text-[11px] font-bold flex items-center gap-1" style={{ color: C.primary }}><Pencil size={11} /> Edit</button>
          </div>
          {s.rows.map(([label, value]) => <Row key={label} label={label} value={value} />)}
        </div>
      ))}

      {!ready && <InlineNotice tone="warn" icon={AlertTriangle}>Some required sections are incomplete. Edit them above before submitting.</InlineNotice>}
      <PillButton full disabled={!ready || submitting} onClick={onSubmit}>{submitting ? "Submitting…" : "Submit Application"}</PillButton>
    </div>
  );
}

/* --------------------------------- shared --------------------------------- */
function SectionHeading({ title, subtitle }) {
  const C = useC();
  return (
    <div>
      <h2 className="font-extrabold text-base" style={{ color: C.navy }}>{title}</h2>
      {subtitle && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{subtitle}</p>}
    </div>
  );
}
function Field({ label, value, onChange, placeholder }) {
  const C = useC();
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );
}
function NumField({ label, value, onChange }) {
  const C = useC();
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );
}
function Toggle({ label, on, onToggle }) {
  const C = useC();
  return (
    <button onClick={onToggle} className="flex-1 flex items-center justify-between rounded-xl px-3 py-2.5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <span className="text-xs font-semibold" style={{ color: C.navy }}>{label}</span>
      <span className="w-9 h-5 rounded-full p-0.5" style={{ background: on ? C.primary : "#D6DFE2" }}>
        <span className="block w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(16px)" : "none" }} />
      </span>
    </button>
  );
}
function Row({ label, value }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-xs" style={{ color: C.muted }}>{label}</span>
      <span className="text-xs font-semibold text-right" style={{ color: C.navy }}>{value}</span>
    </div>
  );
}
