import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, InlineNotice, Divider, Badge, Sheet } from "../../components/shared/ui.jsx";
import { AddressCard } from "../components/AddressCard.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Icon, Check, Plus, Truck, Clock, FileText, ShieldCheck, CheckCircle2, Package } from "../../components/shared/Icon.jsx";
import { DELIVERY_OPTIONS, PAYMENT_METHODS, storeById } from "../../data/stores.js";
import { PROVINCES, districtsFor, municipalitiesFor } from "../../data/locations.js";
import { validateAddress } from "../../utils/validation.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const STEPS = ["Address", "Delivery", "Review", "Payment"];

export default function Checkout({ nav }) {
  const { cartLines, addresses, coupon, storeId, dispatch, commerce, toast, prescriptions, session } = useApp();
  const C = useC();
  const [step, setStep] = useState(0);
  // Addresses load asynchronously and can be added/removed, so the selection is derived from the live list
  // instead of being frozen at mount (which left addressId undefined after a page refresh).
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const addressId = addresses.some((a) => a.id === selectedAddressId)
    ? selectedAddressId
    : (addresses.find((a) => a.isDefault)?.id || addresses[0]?.id);
  const [delivery, setDelivery] = useState("express");
  const [slot, setSlot] = useState(DELIVERY_OPTIONS[2].slots[0]);
  const [payment, setPayment] = useState("card");
  const [notes, setNotes] = useState("");
  const [instructions, setInstructions] = useState("");
  const [placing, setPlacing] = useState(false);
  const [newAddr, setNewAddr] = useState(null);
  const placingRef = useRef(false);

  const rxStatus = useMemo(() => {
    const ids = cartLines.filter((l) => l.product.flags?.prescriptionRequired).map((l) => l.product.id);
    if (!ids.length) return "none";
    const covering = (status) => prescriptions.filter((r) => r.status === status);
    if (ids.every((id) => covering("approved").some((r) => r.items?.includes(id)))) return "approved";
    if (covering("pending").some((r) => r.items?.some((i) => ids.includes(i)))) return "pending";
    return "none";
  }, [cartLines, prescriptions]);
  const requiresPrescription = cartLines.some((l) => l.product.flags?.prescriptionRequired);

  /* Totals, stock and coupon validity are priced by the server — never trusted from local state. */
  const [priced, setPriced] = useState({ issues: [], totals: { subtotal: 0, discount: 0, deliveryFee: 0, tax: 0, total: 0 } });
  const [pricing, setPricing] = useState(false);
  const [priceError, setPriceError] = useState(null);
  const [priceNonce, setPriceNonce] = useState(0);
  useEffect(() => {
    if (!cartLines.length) return undefined;
    let alive = true;
    setPricing(true);
    setPriceError(null);
    commerce.priceCart(cartLines.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty })), { couponCode: coupon, deliveryOptionId: delivery, branch: storeId })
      .then((res) => { if (alive) setPriced(res); })
      .catch((err) => { if (alive) setPriceError(err.message || "Couldn't price your cart"); })
      .finally(() => { if (alive) setPricing(false); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartLines, coupon, delivery, storeId, priceNonce]);
  const totals = priced.totals;
  const couponProblem = coupon && priced.totals.couponResult && priced.totals.couponResult.ok === false
    ? (priced.totals.couponResult.reason || "This coupon can't be applied to your order.") : null;
  const validation = { ok: priced.issues.length === 0 && !pricing && !priceError && !couponProblem, issues: priced.issues, requiresPrescription };
  const address = addresses.find((a) => a.id === addressId);
  const store = storeById(storeId);
  const deliveryOption = DELIVERY_OPTIONS.find((o) => o.id === delivery) || DELIVERY_OPTIONS[0];

  if (!cartLines.length) {
    return (
      <Page>
        <PageHeader title="Checkout" onBack={() => nav("cart")} />
        <InlineNotice tone="info">Your cart is empty. <button className="font-bold underline" onClick={() => nav("home")}>Continue shopping</button></InlineNotice>
      </Page>
    );
  }

  const placeOrder = async () => {
    if (placingRef.current) return;
    if (!validation.ok) { toast(validation.issues[0]?.message || priceError || couponProblem || "Your cart needs attention", "danger"); return; }
    if (!addressId) { toast("Choose a delivery address", "danger"); setStep(0); return; }
    if (requiresPrescription && rxStatus !== "approved") { toast("A pharmacist needs to verify your prescription first", "danger"); return; }
    placingRef.current = true;
    setPlacing(true);
    try {
      const order = await commerce.placeOrder({
        items: cartLines.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty })),
        addressId, paymentMethod: payment, deliveryOptionId: delivery, slot: delivery === "slot" ? slot : null,
        couponCode: coupon, notes, instructions, branch: storeId,
      });
      dispatch({ type: "NOTIFY_ADD", notification: { id: `n${Date.now()}`, kind: "order", title: "Order confirmed", message: `${order.number} is being prepared at ${store.name}.`, time: "just now", unread: true } });
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: "Order placed", detail: `${order.number} · ${fmt(totals.total)}` } });
      nav("orderConfirmed", { orderId: order.id });
    } catch (err) {
      toast(err.message || "Couldn't place your order", "danger");
    } finally {
      placingRef.current = false;
      setPlacing(false);
    }
  };

  const next = () => {
    if (step === 0 && !addressId) { toast("Choose a delivery address", "danger"); return; }
    if (step === 3) { placeOrder(); return; }
    setStep((s) => s + 1);
  };

  return (
    <Page>
      <PageHeader title="Checkout" subtitle={`Step ${step + 1} of 4 · ${STEPS[step]}`} onBack={() => (step === 0 ? nav("cart") : setStep(step - 1))} />

      {/* Stepper */}
      <div className="px-4 md:px-0 mb-5">
        <div className="flex items-center">
          {STEPS.map((s, i) => (
            <React.Fragment key={s}>
              <button onClick={() => i < step && setStep(i)} className="flex flex-col items-center gap-1 shrink-0">
                <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{ background: i <= step ? C.primary : C.white, color: i <= step ? "#fff" : C.muted, border: `1.5px solid ${i <= step ? C.primary : C.border}` }}>
                  {i < step ? <Check size={14} /> : i + 1}
                </span>
                <span className="text-[10px] font-bold" style={{ color: i <= step ? C.navy : C.muted }}>{s}</span>
              </button>
              {i < STEPS.length - 1 && <span className="flex-1 h-[2px] mx-1 mb-4 rounded" style={{ background: i < step ? C.primary : C.border }} />}
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="md:grid md:grid-cols-[1fr_320px] md:gap-6 md:items-start">
        <div className="px-4 md:px-0 space-y-4">
          {priceError && (
            <InlineNotice tone="danger">
              {priceError} <button className="font-bold underline" onClick={() => setPriceNonce((n) => n + 1)}>Try again</button>
            </InlineNotice>
          )}
          {priced.issues[0] && <InlineNotice tone="danger">{priced.issues[0].message}</InlineNotice>}
          {couponProblem && (
            <InlineNotice tone="warn">
              {couponProblem} <button className="font-bold underline" onClick={() => dispatch({ type: "COUPON", code: null })}>Remove coupon</button>
            </InlineNotice>
          )}

          {step === 0 && (
            <>
              {addresses.map((a) => (
                <AddressCard key={a.id} address={a} selectable selected={a.id === addressId} onSelect={setSelectedAddressId} />
              ))}
              <PillButton variant="outline" full onClick={() => setNewAddr({ label: "Home", name: session.user.name, line1: "", line2: "", city: "", zip: "", phone: session.user.phone, isDefault: false })}>
                <Plus size={15} /> Add a new address
              </PillButton>
              <div>
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Delivery instructions</label>
                <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2}
                  placeholder="Gate code, floor, where to leave it…"
                  className="w-full mt-2 rounded-2xl p-3 text-sm outline-none resize-none"
                  style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
              </div>
            </>
          )}

          {step === 1 && (
            <>
              {DELIVERY_OPTIONS.map((o) => {
                const free = o.freeAbove && priced.totals.subtotal - priced.totals.discount >= o.freeAbove;
                return (
                  <button key={o.id} onClick={() => setDelivery(o.id)} className="w-full text-left rounded-2xl p-4 flex items-center gap-3"
                    style={{ background: C.white, border: `1.5px solid ${delivery === o.id ? C.primary : C.border}` }}>
                    <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                      {o.id === "express" ? <Truck size={17} style={{ color: C.primary }} /> : <Clock size={17} style={{ color: C.primary }} />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-sm" style={{ color: C.navy }}>{o.label}</span>
                      <span className="block text-xs" style={{ color: C.muted }}>{o.detail}</span>
                    </span>
                    <span className="font-bold text-sm shrink-0" style={{ color: free || o.fee === 0 ? TONE.ok : C.navy }}>
                      {free || o.fee === 0 ? "Free" : fmt(o.fee)}
                    </span>
                  </button>
                );
              })}
              {delivery === "slot" && (
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Choose a slot</p>
                  <div className="flex flex-wrap gap-2">
                    {DELIVERY_OPTIONS[2].slots.map((s) => (
                      <button key={s} onClick={() => setSlot(s)} className="px-3 py-2 rounded-xl text-xs font-bold"
                        style={{ background: slot === s ? C.mint : C.white, border: `1.5px solid ${slot === s ? C.primary : C.border}`, color: slot === s ? C.primary : C.navy }}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <InlineNotice tone="info" icon={ShieldCheck}>
                Delivery is confirmed with a one-time code at your door, so nothing is left with the wrong person.
              </InlineNotice>
            </>
          )}

          {step === 2 && (
            <>
              <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                {cartLines.map((l, i) => (
                  <div key={l.key} className="flex items-center gap-3 p-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                    <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><ProductArt product={l.product} variantId={l.variantId} size={34} rounded={false} /></span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-bold truncate" style={{ color: C.navy }}>{l.product.name}</span>
                      <span className="block text-xs" style={{ color: C.muted }}>{l.variant ? `${l.variant.label} · ` : ""}Qty {l.qty}</span>
                    </span>
                    <span className="text-sm font-bold shrink-0" style={{ color: C.navy }}>{fmt(l.lineTotal)}</span>
                  </div>
                ))}
              </div>
              {address && <AddressCard address={address} />}
              <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                <Truck size={16} style={{ color: C.primary }} />
                <div className="flex-1">
                  <p className="text-sm font-bold" style={{ color: C.navy }}>{deliveryOption.label}</p>
                  <p className="text-xs" style={{ color: C.muted }}>{delivery === "slot" ? slot : deliveryOption.detail}</p>
                </div>
                <button onClick={() => setStep(1)} className="text-xs font-bold" style={{ color: C.primary }}>Change</button>
              </div>
              {requiresPrescription && (
                <InlineNotice tone={rxStatus === "approved" ? "ok" : "warn"} icon={FileText}>
                  {rxStatus === "approved"
                    ? "Prescription verified — your medicines will be dispensed with this order."
                    : "A pharmacist will verify your prescription before dispatch."}
                </InlineNotice>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-wide" style={{ color: C.muted }}>Order notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Anything the store should know?"
                  className="w-full mt-2 rounded-2xl p-3 text-sm outline-none resize-none"
                  style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
              </div>
            </>
          )}

          {step === 3 && (
            <>
              {PAYMENT_METHODS.filter((m) => m.enabled).map((m) => (
                <button key={m.id} onClick={() => setPayment(m.id)} className="w-full text-left rounded-2xl p-4 flex items-center gap-3"
                  style={{ background: C.white, border: `1.5px solid ${payment === m.id ? C.primary : C.border}` }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                    <Icon name={m.icon} size={17} style={{ color: C.primary }} />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm" style={{ color: C.navy }}>{m.label}</span>
                    <span className="block text-xs" style={{ color: C.muted }}>{m.detail}</span>
                  </span>
                  {payment === m.id && <Check size={17} style={{ color: C.primary }} />}
                </button>
              ))}
              <InlineNotice tone="ok" icon={ShieldCheck}>Payments are encrypted. Card details are never stored on your device.</InlineNotice>
            </>
          )}
        </div>

        {/* Summary rail */}
        <aside className="px-4 md:px-0 mt-5 md:mt-0 md:sticky md:top-[128px]">
          <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Order summary</p>
            <Line label="Subtotal" value={fmt(totals.subtotal)} />
            {totals.discount > 0 && <Line label="Coupon" value={`− ${fmt(totals.discount)}`} tone={TONE.ok} />}
            <Line label="Delivery" value={totals.deliveryFee === 0 ? "Free" : fmt(totals.deliveryFee)} />
            {totals.tax > 0 && <Line label="Tax" value={fmt(totals.tax)} />}
            <Divider className="my-3" />
            <div className="flex items-center justify-between mb-4">
              <span className="font-extrabold" style={{ color: C.navy }}>Total</span>
              <span className="font-extrabold text-lg" style={{ color: C.navy }}>{fmt(totals.total)}</span>
            </div>
            <PillButton full onClick={next} disabled={placing || pricing || !validation.ok}>
              {placing ? "Placing order…" : pricing ? "Pricing…" : step === 3 ? (payment === "cod" ? `Place order · ${fmt(totals.total)}` : `Pay ${fmt(totals.total)}`) : "Continue"}
            </PillButton>
            <p className="text-[11px] text-center mt-2" style={{ color: C.muted }}>Fulfilled by {store.name}</p>
          </div>
        </aside>
      </div>

      <Sheet open={!!newAddr} onClose={() => setNewAddr(null)} title="Add address"
        footer={<PillButton full onClick={async () => {
          const v = validateAddress(newAddr, { requireNepal: true });
          if (!v.ok) { toast(Object.values(v.errors)[0], "danger"); return; }
          try {
            const saved = await commerce.createAddress(newAddr);
            setSelectedAddressId(saved.id); setNewAddr(null); toast("Address saved");
          } catch (err) {
            toast(err.message || "Couldn't save the address", "danger");
          }
        }}>Save address</PillButton>}>
        {newAddr && <AddressForm value={newAddr} onChange={setNewAddr} />}
      </Sheet>
    </Page>
  );
}

function Line({ label, value, tone }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: C.muted }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: tone || C.navy }}>{value}</span>
    </div>
  );
}

export function AddressForm({ value, onChange }) {
  const C = useC();
  const field = (key, label, placeholder) => (
    <div key={key}>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input value={value[key] || ""} onChange={(e) => onChange({ ...value, [key]: e.target.value })} placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none"
        style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );
  const districts = districtsFor(value.provinceId);
  const municipalities = municipalitiesFor(value.districtId);
  const select = (val, onSelect, placeholder, options) => (
    <select value={val || ""} onChange={(e) => onSelect(e.target.value)}
      className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {["Home", "Work", "Other"].map((l) => (
          <button key={l} onClick={() => onChange({ ...value, label: l })} className="px-3 py-2 rounded-xl text-xs font-bold"
            style={{ background: value.label === l ? C.mint : C.white, border: `1.5px solid ${value.label === l ? C.primary : C.border}`, color: value.label === l ? C.primary : C.navy }}>
            {l}
          </button>
        ))}
      </div>
      {field("name", "Full name", "Alex Morgan")}
      {field("line1", "Address / street", "House 24, Maple Marg")}
      {field("line2", "Address line 2 (optional)", "Apartment, floor, etc.")}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Province</label>
          {select(value.provinceId, (id) => onChange({ ...value, provinceId: id, districtId: "", municipalityId: "" }), "Select province", PROVINCES)}
        </div>
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>District</label>
          {select(value.districtId, (id) => onChange({ ...value, districtId: id, municipalityId: "" }), value.provinceId ? "Select district" : "Choose province first", districts)}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Municipality</label>
          {select(value.municipalityId, (id) => onChange({ ...value, municipalityId: id }), value.districtId ? "Select municipality" : "Choose district first", municipalities)}
        </div>
        {field("ward", "Ward No.", "4")}
      </div>
      {field("landmark", "Landmark (optional)", "Near Basantapur")}
      <div className="grid grid-cols-2 gap-3">
        {field("city", "City (legacy)", "Metro City")}
        {field("zip", "Postcode (optional)", "10245")}
      </div>
      {field("phone", "Phone", "+1 555 0190")}
      {field("instructions", "Delivery instructions", "Leave with concierge")}
    </div>
  );
}
