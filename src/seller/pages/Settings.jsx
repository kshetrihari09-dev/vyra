import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, Field, Input, Notice, NumberInput, PageHeader, Panel, Tabs, Textarea, Toggle } from "../components/kit.jsx";
import { shrink } from "../components/ImageUploader.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { TONE } from "../../theme.js";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DEFAULT_HOURS = Object.fromEntries(DAYS.map((d) => [d, { open: "09:00", close: "18:00", closed: d === "Sun" }]));

/* Start from what the shop already told us (its approved application), then
   anything they've saved since. Nothing here is invented. */
function initial(seller, application) {
  const shop = application?.shop || {}, ops = application?.operations || {};
  const saved = seller.settings || {};
  return {
    name: seller.name,
    description: saved.description ?? shop.description ?? "",
    logo: saved.logo ?? shop.logo ?? null,
    banner: saved.banner ?? shop.banner ?? null,
    phone: saved.phone ?? shop.contact ?? seller.contactPhone ?? "",
    email: saved.email ?? seller.contactEmail ?? shop.email ?? "",
    address: saved.address ?? shop.address ?? "",
    city: saved.city ?? "",
    landmark: saved.landmark ?? shop.landmark ?? "",
    hours: saved.hours ?? ops.hours ?? DEFAULT_HOURS,
    delivery: { available: ops.deliveryAvailable ?? true, pickup: ops.pickupAvailable ?? true, radiusKm: ops.deliveryRadiusKm ?? 5, fee: ops.deliveryFee ?? 0, freeAbove: ops.freeDeliveryAbove ?? 0, minOrder: ops.minOrderAmount ?? 0, prepMinutes: ops.prepTimeMinutes ?? 30, ...(saved.delivery || {}) },
    payments: { cod: true, card: true, upi: true, netbanking: false, payoutMethod: seller.payoutMethod || "", ...(saved.payments || {}) },
    tax: { registration: "", inclusive: true, defaultRate: 0, ...(saved.tax || {}) },
    notifications: { newOrder: true, lowStock: true, payout: true, reviews: false, email: true, sms: false, ...(saved.notifications || {}) },
  };
}

function ImagePick({ label, hint, value, onChange, wide }) {
  const s = useS();
  const ref = useRef(null);
  const [error, setError] = useState("");
  const pick = async (file) => {
    setError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    try { onChange(await shrink(file, wide ? 1400 : 320)); } catch (e) { setError(e.message); }
    if (ref.current) ref.current.value = "";
  };
  return (
    <div>
      <p className="text-[13px] font-medium mb-1" style={{ color: s.text }}>{label}</p>
      <div className="flex items-center gap-3">
        <div className={`${wide ? "w-40 h-20" : "w-20 h-20"} overflow-hidden flex items-center justify-center shrink-0`} style={{ border: `1px dashed ${s.line}`, borderRadius: s.r, background: s.canvas }}>
          {value ? <img src={value} alt={`${label} preview`} className="w-full h-full object-cover" /> : <Icon name="Image" size={20} style={{ color: s.faint }} />}
        </div>
        <div className="flex flex-col gap-1.5 items-start">
          <Btn size="sm" icon="Upload" onClick={() => ref.current?.click()}>{value ? "Replace" : "Upload"}</Btn>
          {value && <Btn size="sm" variant="ghost" onClick={() => onChange(null)}>Remove</Btn>}
        </div>
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
      <p className="text-xs mt-1.5" style={{ color: error ? TONE.danger : s.muted }}>{error || hint}</p>
    </div>
  );
}

export default function Settings() {
  const s = useS();
  const { seller } = useShop();
  const { shopApplications, dispatch, toast } = useApp();
  const application = shopApplications.find((a) => a.sellerId === seller.id);
  const base = useMemo(() => initial(seller, application), [seller, application]);
  const [d, setD] = useState(base);
  const [tab, setTab] = useState("profile");
  const [errors, setErrors] = useState({});
  useEffect(() => { setD(base); setErrors({}); }, [base]);
  const dirty = JSON.stringify(d) !== JSON.stringify(base);
  const canWrite = seller.status === "active";

  const set = (patch) => setD((p) => ({ ...p, ...patch }));
  const nest = (key, patch) => setD((p) => ({ ...p, [key]: { ...p[key], ...patch } }));
  const setDay = (day, patch) => nest("hours", { [day]: { ...d.hours[day], ...patch } });

  const save = () => {
    const e = {};
    if (!d.name.trim()) e.name = "Enter your shop name.";
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) e.email = "Enter a valid email address.";
    if (d.phone && d.phone.replace(/\D/g, "").length < 7) e.phone = "Enter a valid phone number.";
    DAYS.forEach((k) => { const h = d.hours[k]; if (!h.closed && (!h.open || !h.close || h.open >= h.close)) e[`hours-${k}`] = "Closing time must be after opening time."; });
    if (!(d.tax.defaultRate >= 0 && d.tax.defaultRate <= 100)) e.taxRate = "Enter a rate between 0 and 100.";
    setErrors(e);
    if (Object.keys(e).length) { toast("Fix the highlighted fields", "danger"); if (e.name || e.email || e.phone) setTab(e.name ? "profile" : "contact"); else if (Object.keys(e).some((k) => k.startsWith("hours"))) setTab("hours"); else setTab("tax"); return; }
    const { name, ...rest } = d;
    dispatch({ type: "SELLER_UPDATE", seller: { ...seller, name: name.trim(), contactEmail: d.email || seller.contactEmail, contactPhone: d.phone, payoutMethod: d.payments.payoutMethod || seller.payoutMethod, settings: rest } });
    dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: "Shop settings updated", detail: name.trim() } });
    toast("Shop settings saved");
  };

  return (
    <div className="pb-20">
      <PageHeader title="Shop settings" description="How your shop appears to customers and how it runs." />
      <div className="mb-4"><Notice tone="info">Your shop name, description, logo and banner are saved to your shop profile. Delivery, payment and tax preferences are saved here too, but customer checkout doesn't apply them yet.</Notice></div>
      <Panel padded={false}>
        <div className="px-4 pt-1"><Tabs value={tab} onChange={setTab} items={[
          { id: "profile", label: "Profile" }, { id: "contact", label: "Contact & address" }, { id: "hours", label: "Business hours" },
          { id: "delivery", label: "Delivery" }, { id: "payments", label: "Payments" }, { id: "tax", label: "Tax" }, { id: "notifications", label: "Notifications" },
        ]} /></div>
        <div className="p-5">
          {tab === "profile" && (
            <div className="space-y-4">
              <Field label="Shop name" error={errors.name}><Input value={d.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} /></Field>
              <Field label="Description" hint="Shown on your shop page."><Textarea rows={4} value={d.description} onChange={(e) => set({ description: e.target.value })} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <ImagePick label="Shop logo" hint="Square image works best." value={d.logo} onChange={(logo) => set({ logo })} />
                <ImagePick label="Shop banner" hint="Wide image, at least 1200 px." wide value={d.banner} onChange={(banner) => set({ banner })} />
              </div>
            </div>
          )}
          {tab === "contact" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Phone" error={errors.phone}><Input value={d.phone} onChange={(e) => set({ phone: e.target.value })} inputMode="tel" error={errors.phone} /></Field>
              <Field label="Email" error={errors.email}><Input value={d.email} onChange={(e) => set({ email: e.target.value })} inputMode="email" error={errors.email} /></Field>
              <Field label="Street address" className="sm:col-span-2"><Input value={d.address} onChange={(e) => set({ address: e.target.value })} /></Field>
              <Field label="City"><Input value={d.city} onChange={(e) => set({ city: e.target.value })} /></Field>
              <Field label="Landmark"><Input value={d.landmark} onChange={(e) => set({ landmark: e.target.value })} /></Field>
            </div>
          )}
          {tab === "hours" && (
            <div className="space-y-2">
              {DAYS.map((day) => {
                const h = d.hours[day];
                return (
                  <div key={day} className="flex flex-wrap items-center gap-3 py-1.5">
                    <span className="w-10 text-sm font-medium" style={{ color: s.text }}>{day}</span>
                    <div className="w-24"><Toggle on={!h.closed} onChange={(on) => setDay(day, { closed: !on })} label={`${day} open`} /></div>
                    {h.closed ? <span className="text-sm" style={{ color: s.muted }}>Closed</span> : (
                      <div className="flex items-center gap-2">
                        <Input type="time" value={h.open} onChange={(e) => setDay(day, { open: e.target.value })} aria-label={`${day} opens`} error={errors[`hours-${day}`]} />
                        <span style={{ color: s.muted }}>to</span>
                        <Input type="time" value={h.close} onChange={(e) => setDay(day, { close: e.target.value })} aria-label={`${day} closes`} error={errors[`hours-${day}`]} />
                      </div>
                    )}
                    {errors[`hours-${day}`] && <span className="text-xs font-medium" style={{ color: TONE.danger }}>{errors[`hours-${day}`]}</span>}
                  </div>
                );
              })}
            </div>
          )}
          {tab === "delivery" && (
            <div>
              <Toggle label="Offer delivery" hint="Customers can have orders brought to them" on={d.delivery.available} onChange={(v) => nest("delivery", { available: v })} />
              <Toggle label="Offer pickup" hint="Customers can collect orders from your shop" on={d.delivery.pickup} onChange={(v) => nest("delivery", { pickup: v })} />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-3">
                <Field label="Delivery radius"><NumberInput suffix="km" value={d.delivery.radiusKm} onChange={(n) => nest("delivery", { radiusKm: n })} /></Field>
                <Field label="Delivery fee"><NumberInput step="0.01" prefix="$" value={d.delivery.fee} onChange={(n) => nest("delivery", { fee: n })} /></Field>
                <Field label="Free delivery above"><NumberInput step="0.01" prefix="$" value={d.delivery.freeAbove} onChange={(n) => nest("delivery", { freeAbove: n })} /></Field>
                <Field label="Minimum order"><NumberInput step="0.01" prefix="$" value={d.delivery.minOrder} onChange={(n) => nest("delivery", { minOrder: n })} /></Field>
                <Field label="Preparation time"><NumberInput suffix="min" value={d.delivery.prepMinutes} onChange={(n) => nest("delivery", { prepMinutes: n })} /></Field>
              </div>
            </div>
          )}
          {tab === "payments" && (
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: s.text }}>Accepted payment methods</p>
              <Toggle label="Cash on delivery" on={d.payments.cod} onChange={(v) => nest("payments", { cod: v })} />
              <Toggle label="Card" on={d.payments.card} onChange={(v) => nest("payments", { card: v })} />
              <Toggle label="UPI / wallet" on={d.payments.upi} onChange={(v) => nest("payments", { upi: v })} />
              <Toggle label="Net banking" on={d.payments.netbanking} onChange={(v) => nest("payments", { netbanking: v })} />
              <div className="mt-4 max-w-sm"><Field label="Payout method" hint="Where your earnings are sent"><Input value={d.payments.payoutMethod} onChange={(e) => nest("payments", { payoutMethod: e.target.value })} /></Field></div>
            </div>
          )}
          {tab === "tax" && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Tax registration number" hint="PAN, VAT or GST number"><Input value={d.tax.registration} onChange={(e) => nest("tax", { registration: e.target.value })} /></Field>
                <Field label="Default tax rate for new products" error={errors.taxRate}><NumberInput step="0.1" suffix="%" value={d.tax.defaultRate} onChange={(n) => nest("tax", { defaultRate: n })} error={errors.taxRate} /></Field>
              </div>
              <Toggle label="Prices include tax" hint="Turn off if tax is added on top of your selling price" on={d.tax.inclusive} onChange={(v) => nest("tax", { inclusive: v })} />
            </div>
          )}
          {tab === "notifications" && (
            <div>
              <p className="text-sm font-medium" style={{ color: s.text }}>Tell me about</p>
              <Toggle label="New orders" on={d.notifications.newOrder} onChange={(v) => nest("notifications", { newOrder: v })} />
              <Toggle label="Low stock" on={d.notifications.lowStock} onChange={(v) => nest("notifications", { lowStock: v })} />
              <Toggle label="Payouts" on={d.notifications.payout} onChange={(v) => nest("notifications", { payout: v })} />
              <Toggle label="Customer reviews" on={d.notifications.reviews} onChange={(v) => nest("notifications", { reviews: v })} />
              <p className="text-sm font-medium mt-4" style={{ color: s.text }}>Send by</p>
              <Toggle label="Email" on={d.notifications.email} onChange={(v) => nest("notifications", { email: v })} />
              <Toggle label="SMS" on={d.notifications.sms} onChange={(v) => nest("notifications", { sms: v })} />
            </div>
          )}
        </div>
      </Panel>

      <div className="fixed bottom-14 md:bottom-0 inset-x-0 md:left-16 lg:left-60 z-20 px-4 md:px-6 py-3 flex items-center justify-between gap-3" style={{ background: s.panel, borderTop: `1px solid ${s.line}`, opacity: dirty ? 1 : 0, pointerEvents: dirty ? "auto" : "none", transition: "opacity .15s", paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }} aria-hidden={!dirty}>
        <p className="text-sm" style={{ color: s.muted }}>You have unsaved changes</p>
        <div className="flex gap-2"><Btn onClick={() => { setD(base); setErrors({}); }}>Discard</Btn><Btn variant="primary" onClick={save} disabled={!canWrite}>Save changes</Btn></div>
      </div>
    </div>
  );
}
