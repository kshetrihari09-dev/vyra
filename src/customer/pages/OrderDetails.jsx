import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, Divider, InlineNotice, Sheet, ConfirmDialog } from "../../components/shared/ui.jsx";
import { OrderTimeline, STATUS_STYLE, ORDER_STAGES, stageIndex } from "../components/OrderTimeline.jsx";
import { AddressCard } from "../components/AddressCard.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Icon, Phone, FileText, Headphones, Copy, ShieldCheck, Bike, X, Check } from "../../components/shared/Icon.jsx";
import { productById } from "../../data/products.js";
import { storeById, PAYMENT_METHODS } from "../../data/stores.js";
import { fmt, dateTimeLabel, timeLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

export default function OrderDetails({ nav, params }) {
  const { myOrders, orders: allOrders, session, products, addresses, commerce, toast } = useApp();
  /* Shoppers open only their own orders; staff consoles link here for any order. */
  const orders = session.isStaff ? allOrders : myOrders;
  const C = useC();
  const order = orders.find((o) => o.id === params.orderId);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [otpOpen, setOtpOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!order) return <Page><PageHeader title="Order not found" onBack={() => nav("orders")} /></Page>;

  const address = addresses.find((a) => a.id === order.addressId) || (order.shipTo ? { id: "snapshot", label: "Delivery address", ...order.shipTo } : null);
  const store = storeById(order.storeId);
  const payment = PAYMENT_METHODS.find((p) => p.id === order.paymentMethod);
  const style = STATUS_STYLE[order.status];
  const canCancel = stageIndex(order.status) < stageIndex("packed") && !["cancelled", "returned"].includes(order.status);
  const live = !["delivered", "cancelled", "returned"].includes(order.status);

  /* Demo control: advances the lifecycle the way the delivery app would. Goes through the real API, so it only
     works for a signed-in account with orders:update_status — a plain customer viewing their own order won't be
     able to move it forward, same as in production. */
  const advance = async () => {
    const i = stageIndex(order.status);
    const nextStage = ORDER_STAGES[i + 1];
    if (!nextStage) return;
    if (nextStage.id === "delivered" && order.otpRequired) { setOtpOpen(true); return; }
    setBusy(true);
    try {
      await commerce.advanceOrder(order.id, nextStage.id);
      toast(`Order ${nextStage.label.toLowerCase()}`);
    } catch (err) {
      toast(err.message || "Couldn't update the order", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title={order.number} subtitle={dateTimeLabel(order.placedAt)} onBack={() => nav("orders")}
        right={<Badge tone={style.tone}>{style.label}</Badge>} />

      <div className="px-4 md:px-0 md:grid md:grid-cols-[1fr_340px] md:gap-6 md:items-start space-y-4 md:space-y-0">
        <div className="space-y-4">
          {/* Delivery OTP */}
          {live && order.otpRequired && order.otp && stageIndex(order.status) >= stageIndex("assigned") && (
            <div className="rounded-2xl p-4" style={{ background: C.navy }}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} color="#fff" />
                <p className="text-white font-bold text-sm">Delivery OTP</p>
              </div>
              <p className="text-white/70 text-xs mb-3">Share this code with the rider only when your order is in your hands.</p>
              <div className="flex items-center gap-2">
                {order.otp.split("").map((d, i) => (
                  <span key={i} className="w-11 h-12 rounded-xl flex items-center justify-center font-extrabold text-xl"
                    style={{ background: "rgba(255,255,255,.16)", color: "#fff" }}>{d}</span>
                ))}
                <button onClick={() => { navigator.clipboard?.writeText(order.otp); toast("OTP copied"); }}
                  className="ml-auto w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,.16)" }}>
                  <Copy size={16} color="#fff" />
                </button>
              </div>
            </div>
          )}

          {/* Rider */}
          {order.partner && live && (
            <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Bike size={18} style={{ color: C.primary }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: C.navy }}>{order.partner.name}</p>
                <p className="text-xs" style={{ color: C.muted }}>{order.partner.vehicle}</p>
              </div>
              <a href={`tel:${order.partner.phone}`} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: C.primary }}>
                <Phone size={16} color="#fff" />
              </a>
            </div>
          )}

          {live && order.eta && (
            <InlineNotice tone="info">Estimated arrival by {timeLabel(order.eta)} · fulfilled by {store.name}</InlineNotice>
          )}

          {/* Timeline */}
          <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-sm mb-4" style={{ color: C.navy }}>Delivery status</p>
            <OrderTimeline order={order} />
            {live && (
              <div className="mt-3 pt-3" style={{ borderTop: `1px dashed ${C.border}` }}>
                <PillButton size="sm" variant="ghost" full onClick={advance} disabled={busy}>
                  Simulate next status ({ORDER_STAGES[stageIndex(order.status) + 1]?.label})
                </PillButton>
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="px-4 pt-4 pb-2 font-extrabold text-sm" style={{ color: C.navy }}>{order.items.length} items</p>
            {order.items.map((it, i) => {
              const p = productById(it.productId, products);
              if (!p) return null;
              const variant = (p.variants || []).find((v) => v.id === it.variantId);
              return (
                <button key={it.productId + (it.variantId || "")} onClick={() => nav("product", { productId: p.id })}
                  className="w-full flex items-center gap-3 p-3 text-left" style={{ borderTop: `1px solid ${C.border}` }}>
                  <span className="w-12 h-12 rounded-xl overflow-hidden shrink-0"><ProductArt product={p} variantId={it.variantId} size={34} rounded={false} /></span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold truncate" style={{ color: C.navy }}>{p.name}</span>
                    <span className="block text-xs" style={{ color: C.muted }}>{variant ? `${variant.label} · ` : ""}Qty {it.qty} × {fmt(it.unitPrice)}</span>
                  </span>
                  <span className="text-sm font-bold shrink-0" style={{ color: C.navy }}>{fmt(it.unitPrice * it.qty)}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4 md:sticky md:top-[128px]">
          <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Payment summary</p>
            <Row label="Subtotal" value={fmt(order.totals.subtotal)} />
            {order.totals.discount > 0 && <Row label="Discount" value={`− ${fmt(order.totals.discount)}`} tone={TONE.ok} />}
            <Row label="Delivery" value={order.totals.deliveryFee === 0 ? "Free" : fmt(order.totals.deliveryFee)} />
            {order.totals.tax > 0 && <Row label="Tax" value={fmt(order.totals.tax)} />}
            <Divider className="my-2.5" />
            <Row label="Total paid" value={fmt(order.totals.total)} bold />
            <p className="text-xs mt-2" style={{ color: C.muted }}>Paid with {payment?.label || order.paymentMethod}</p>
          </div>

          {address && <AddressCard address={address} />}

          <div className="grid grid-cols-2 gap-2">
            <PillButton variant="subtle" size="sm" onClick={() => toast("Invoice downloaded")}><FileText size={13} /> Invoice</PillButton>
            <PillButton variant="subtle" size="sm" onClick={() => nav("support", { orderId: order.id })}><Headphones size={13} /> Support</PillButton>
          </div>
          {canCancel && (
            <PillButton variant="danger" full size="sm" onClick={() => setConfirmCancel(true)}><X size={13} /> Cancel order</PillButton>
          )}
        </aside>
      </div>

      <ConfirmDialog open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Cancel this order?"
        message="The order will be cancelled and any payment refunded within 3–5 working days. This can't be undone."
        confirmLabel="Cancel order"
        onConfirm={async () => {
          try { await commerce.cancelOrder(order.id); toast("Order cancelled"); }
          catch (err) { toast(err.message || "Couldn't cancel the order", "danger"); }
          finally { setConfirmCancel(false); }
        }} />

      <OtpSheet open={otpOpen} onClose={() => setOtpOpen(false)} order={order}
        onVerified={async () => {
          try {
            await commerce.advanceOrder(order.id, "delivered");
            toast("Delivery verified");
          } catch (err) {
            toast(err.message || "Couldn't confirm delivery", "danger");
          } finally {
            setOtpOpen(false);
          }
        }} />
    </Page>
  );
}

function Row({ label, value, tone, bold }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between py-1">
      <span className={bold ? "font-extrabold text-sm" : "text-sm"} style={{ color: bold ? C.navy : C.muted }}>{label}</span>
      <span className={bold ? "font-extrabold text-sm" : "text-sm font-semibold"} style={{ color: tone || C.navy }}>{value}</span>
    </div>
  );
}

/** The rider's side of the handover: delivery only completes on a correct code. */
export function OtpSheet({ open, onClose, order, onVerified }) {
  const C = useC();
  const [entry, setEntry] = useState("");
  const [error, setError] = useState("");
  const verify = () => {
    if (entry.trim() === order.otp) { setEntry(""); setError(""); onVerified(); }
    else setError("That code doesn't match. Ask the customer to read it again.");
  };
  return (
    <Sheet open={open} onClose={onClose} title="Verify delivery"
      footer={<PillButton full onClick={verify} disabled={entry.length !== 4}><Check size={15} /> Confirm delivery</PillButton>}>
      <p className="text-sm mb-4" style={{ color: C.muted }}>
        The delivery partner enters the customer's 4-digit code. The order is only marked delivered once it matches.
      </p>
      <input value={entry} onChange={(e) => { setEntry(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
        inputMode="numeric" placeholder="0000" aria-label="Delivery OTP"
        className="w-full text-center tracking-[0.5em] font-extrabold text-2xl rounded-2xl h-16 outline-none"
        style={{ background: C.white, border: `1.5px solid ${error ? TONE.danger : C.border}`, color: C.navy }} />
      {error && <p className="text-xs mt-2 font-semibold" style={{ color: TONE.danger }}>{error}</p>}
      <p className="text-[11px] mt-3" style={{ color: C.muted }}>Demo hint: the code for this order is {order.otp}.</p>
    </Sheet>
  );
}
