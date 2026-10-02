import React, { useEffect, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, Divider, InlineNotice, ConfirmDialog } from "../../components/shared/ui.jsx";
import { OrderTimeline, STATUS_STYLE, stageIndex } from "../components/OrderTimeline.jsx";
import { AddressCard } from "../components/AddressCard.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Icon, Phone, FileText, Headphones, Copy, ShieldCheck, Bike, X } from "../../components/shared/Icon.jsx";
import { deliveryApi } from "../../services/api/deliveryApi.js";
import { paymentsApi } from "../../services/api/paymentsApi.js";
import { canCancel as orderCanCancel, isPrepaid, paymentStatusOf } from "../../services/orderStatus.js";
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
  const [retrying, setRetrying] = useState(false);
  const [payInfo, setPayInfo] = useState(null);

  /* Live tracking (Phase 7): the rider's last shared position, only while the order is out for delivery. Polled —
     the server deletes the location trail when the run ends. */
  const [tracking, setTracking] = useState(null);
  const trackable = !!order && stageIndex(order.status) >= stageIndex("assigned") && ![ "delivered", "cancelled", "returned" ].includes(order.status);
  useEffect(() => {
    if (!trackable) { setTracking(null); return undefined; }
    let stop = false;
    const pull = () => deliveryApi.tracking(order.id).then((t) => {
      if (stop) return;
      setTracking(t);
      // The rider moves the order on the server; pull the fresh copy (status, partner, code) into the cache.
      if (t.orderStatus !== order.status) commerce.refreshOrder(order.id).catch(() => {});
    }).catch(() => {});
    pull();
    const timer = setInterval(pull, 15_000);
    return () => { stop = true; clearInterval(timer); };
  }, [order?.id, order?.status, trackable]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!order) return <Page><PageHeader title="Order not found" onBack={() => nav("orders")} /></Page>;

  const address = addresses.find((a) => a.id === order.addressId) || (order.shipTo ? { id: "snapshot", label: "Delivery address", ...order.shipTo } : null);
  const store = storeById(order.storeId);
  const payment = PAYMENT_METHODS.find((p) => p.id === order.paymentMethod);
  const style = STATUS_STYLE[order.status];
  // Mirrors the backend: cancelling is only possible before "packed" (the server also sends `actions.canCancel`).
  const canCancel = orderCanCancel(order);
  const pay = paymentStatusOf(order);
  const canRetryPayment = isPrepaid(order) && order.paymentStatus === "pending" && !["cancelled", "returned", "delivered"].includes(order.status);
  const retryPayment = async () => {
    setRetrying(true);
    try {
      const res = await paymentsApi.retry(order.id);
      setPayInfo(res.payment);
      toast(res.created ? "New payment started for this order" : "Your payment is still waiting — use the reference below");
    } catch (err) {
      toast(err.message || "Couldn't restart the payment", "danger");
      commerce.refreshOrder(order.id).catch(() => {});
    } finally { setRetrying(false); }
  };
  const live = !["delivered", "cancelled", "returned"].includes(order.status);
  const loc = tracking?.delivery?.location;

  return (
    <Page>
      <PageHeader title={order.number} subtitle={dateTimeLabel(order.placedAt)} onBack={() => nav("orders")}
        right={<span className="flex items-center gap-1.5"><Badge tone={style.tone}>{style.label}</Badge><Badge tone={pay.tone}>{pay.label}</Badge></span>} />

      <div className="px-4 md:px-0 md:grid md:grid-cols-[1fr_340px] md:gap-6 md:items-start space-y-4 md:space-y-0">
        <div className="space-y-4">
          {/* Delivery OTP */}
          {live && order.otpRequired && order.otp && stageIndex(order.status) >= stageIndex("assigned") && (
            <div className="rounded-2xl p-4" style={{ background: C.navy }}>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} color="#fff" />
                <p className="text-white font-bold text-sm">Delivery OTP</p>
              </div>
              <p className="text-white/70 text-xs mb-3">Read this code to the rider only when your order is in your hands. Riders never see it in their app.</p>
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

          {loc && (
            <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer"
              className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: C.mint }}><Bike size={18} style={{ color: C.primary }} /></span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm" style={{ color: C.navy }}>Track your rider</span>
                <span className="block text-xs" style={{ color: C.muted }}>Last seen {timeLabel(loc.updatedAt)} · tap to open the map</span>
              </span>
            </a>
          )}

          {/* Timeline */}
          <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-sm mb-4" style={{ color: C.navy }}>Delivery status</p>
            <OrderTimeline order={order} />
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
            <Row label={pay.paid ? "Total paid" : pay.prepaid ? "Total" : "Total due"} value={fmt(order.totals.total)} bold />
            <Row label="Payment" value={pay.label} tone={pay.tone === "ok" ? TONE.ok : pay.tone === "warn" ? TONE.warn : undefined} />
            <p className="text-xs mt-1" style={{ color: C.muted }}>{pay.prepaid ? `Method: ${payment?.label || order.paymentMethod}` : "Pay the rider in cash on delivery"}</p>
            {canRetryPayment && (
              <div className="mt-3">
                <PillButton full size="sm" onClick={retryPayment} disabled={retrying}>{retrying ? "Working…" : "Retry payment"}</PillButton>
                {payInfo?.instructions?.note && <p className="text-xs mt-2" style={{ color: C.muted }}>{payInfo.instructions.note}</p>}
              </div>
            )}
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
        message={pay.paid ? "The order will be cancelled and your payment refunded within 3–5 working days. This can't be undone." : "The order will be cancelled. This can't be undone."}
        confirmLabel="Cancel order"
        onConfirm={async () => {
          try { await commerce.cancelOrder(order.id); toast("Order cancelled"); }
          catch (err) {
            toast(err.message || "Couldn't cancel the order", "danger");
            commerce.refreshOrder(order.id).catch(() => {}); // the order may have moved on (e.g. just packed) — re-sync so the button disappears
          }
          finally { setConfirmCancel(false); }
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
