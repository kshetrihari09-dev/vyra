import React, { useEffect, useMemo, useState } from "react";
import { distanceLabel, feeBasis } from "../../utils/deliveryFee.js";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, EmptyState, InlineNotice, Divider, SectionHeader, Badge } from "../../components/shared/ui.jsx";
import { CartItem } from "../components/CartItem.jsx";
import { ProductRail } from "../components/ProductCard.jsx";
import { ShoppingCart, Tag, X, Check, ShieldCheck, Bookmark } from "../../components/shared/Icon.jsx";

import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

export default function Cart({ nav }) {
  const { cartLines, savedLines, coupon, dispatch, commerce, toast, storeId, products, prescriptions, addresses } = useApp();
  const C = useC();
  const [code, setCode] = useState(coupon || "");

  const rxStatus = useMemo(() => {
    const ids = cartLines.filter((l) => l.product.flags?.prescriptionRequired).map((l) => l.product.id);
    if (!ids.length) return "none";
    const rx = prescriptions.find((r) => r.items.some((i) => ids.includes(i)));
    return rx?.status || "none";
  }, [cartLines, prescriptions]);

  const requiresPrescription = cartLines.some((l) => l.product.flags?.prescriptionRequired);
  const savings = useMemo(() => Math.round(cartLines.reduce((s, l) => s + (l.mrp - l.unitPrice) * l.qty, 0) * 100) / 100, [cartLines]);

  const defaultAddressId = (addresses.find((a) => a.isDefault) || addresses[0])?.id;

  /* Stock, prices and coupon validity are priced by the server — this is what decides whether checkout is allowed. */
  const [priced, setPriced] = useState({ issues: [], totals: { subtotal: 0, discount: 0, deliveryFee: 0, tax: 0, total: 0 }, couponResult: null });
  useEffect(() => {
    if (!cartLines.length) return undefined;
    let alive = true;
    commerce.priceCart(cartLines.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty })), { couponCode: coupon, deliveryOptionId: "standard", branch: storeId, addressId: defaultAddressId })
      .then((res) => { if (alive) setPriced({ ...res, couponResult: res.totals.couponResult }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [cartLines, coupon, storeId, commerce, defaultAddressId]);
  const totals = priced.totals;
  // Honest wording: an exact fee needs a pin; without one it is an estimate, and with no address at all it is decided at checkout.
  const basis = feeBasis(totals.delivery);
  const deliveryText = basis.kind === "pin" ? (totals.deliveryFee === 0 ? "Free" : fmt(totals.deliveryFee))
    : addresses.length === 0 ? "At checkout" : `Est. ${fmt(totals.deliveryFee)}`;
  // "Out of range" concerns the DEFAULT address only (used here to show a fee). The shopper may pick another address at
  // checkout, so it must not block the cart — checkout enforces it for the address actually chosen.
  const blocking = priced.issues.filter((i) => i.type !== "out_of_range");
  const validation = { ok: blocking.length === 0, issues: blocking.map((i) => ({ key: `${i.productId}:${i.variantId || ""}`, type: i.type, message: i.message })), requiresPrescription };

  const suggestions = useMemo(() => {
    const inCart = new Set(cartLines.map((l) => l.product.id));
    return products.filter((p) => !inCart.has(p.id)).sort((a, b) => b.sold - a.sold).slice(0, 8);
  }, [cartLines, products]);

  const applyCoupon = async () => {
    if (!code.trim()) return;
    dispatch({ type: "COUPON", code: code.trim().toUpperCase() });
    try {
      const res = await commerce.priceCart(cartLines.map((l) => ({ productId: l.product.id, variantId: l.variantId, qty: l.qty })), { couponCode: code.trim(), deliveryOptionId: "standard", branch: storeId });
      const result = res.totals.couponResult;
      if (result?.ok) toast(`Coupon applied — you saved ${fmt(result.discount)}`);
      else toast(result?.reason || "Coupon not valid", "danger");
    } catch (err) {
      toast(err.message || "Couldn't check that code", "danger");
    }
  };

  if (!cartLines.length && !savedLines.length) {
    return (
      <Page>
        <PageHeader title="Your Cart" onBack={() => nav("home")} />
        <EmptyState icon={ShoppingCart} title="Your cart is empty" message="Browse categories and add something you need." action="Start shopping" onAction={() => nav("categories")} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Your Cart" subtitle={`${cartLines.length} item${cartLines.length === 1 ? "" : "s"}`} onBack={() => nav("home")} />

      <div className="md:grid md:grid-cols-[1fr_340px] md:gap-6 md:items-start">
        <div className="px-4 md:px-0 space-y-3">
          {validation.issues.map((issue) => (
            <InlineNotice key={issue.key + issue.type} tone={issue.type === "prescription" ? "info" : "danger"}>
              {issue.message}
              {issue.type === "prescription" && rxStatus === "none" && (
                <button onClick={() => nav("prescription")} className="block font-bold underline mt-1">Upload prescription</button>
              )}
            </InlineNotice>
          ))}

          {cartLines.map((line) => <CartItem key={line.key} line={line} onOpen={(id) => nav("product", { productId: id })} />)}

          {savedLines.length > 0 && (
            <div className="pt-4">
              <div className="flex items-center gap-2 mb-3">
                <Bookmark size={15} style={{ color: C.primary }} />
                <h2 className="font-extrabold text-sm" style={{ color: C.navy }}>Saved for later ({savedLines.length})</h2>
              </div>
              <div className="space-y-3">
                {savedLines.map((line) => <CartItem key={line.key} line={line} saved onOpen={(id) => nav("product", { productId: id })} />)}
              </div>
            </div>
          )}
        </div>

        {/* Summary */}
        <aside className="px-4 md:px-0 mt-5 md:mt-0 md:sticky md:top-[128px]">
          <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Price details</p>

            <div className="flex gap-2 mb-3">
              <div className="flex-1 flex items-center gap-2 rounded-xl px-3 h-11" style={{ background: C.bg, border: `1px dashed ${C.primary}` }}>
                <Tag size={14} style={{ color: C.primary }} />
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Coupon code"
                  className="flex-1 bg-transparent outline-none text-sm font-semibold min-w-0" style={{ color: C.navy }} aria-label="Coupon code" />
                {coupon && (
                  <button aria-label="Remove coupon" onClick={() => { dispatch({ type: "COUPON", code: null }); setCode(""); }}>
                    <X size={14} style={{ color: C.muted }} />
                  </button>
                )}
              </div>
              <PillButton size="sm" onClick={applyCoupon}>Apply</PillButton>
            </div>

            {coupon && priced.couponResult && (
              <p className="text-[11px] mb-3 font-semibold" style={{ color: priced.couponResult.ok ? TONE.ok : TONE.danger }}>
                {priced.couponResult.ok ? `✓ Coupon applied — you saved ${fmt(priced.couponResult.discount)}` : priced.couponResult.reason}
              </p>
            )}

            <Row label={`Subtotal (${cartLines.reduce((s, l) => s + l.qty, 0)} items)`} value={fmt(totals.subtotal)} />
            {savings > 0 && <Row label="Product savings" value={`− ${fmt(savings)}`} tone={TONE.ok} />}
            {totals.discount > 0 && <Row label="Coupon discount" value={`− ${fmt(totals.discount)}`} tone={TONE.ok} />}
            <Row label={`Delivery${distanceLabel(totals.delivery) ? ` · ${distanceLabel(totals.delivery)}` : ""}`} value={deliveryText} />
            {totals.tax > 0 && <Row label="Tax" value={fmt(totals.tax)} />}
            <Divider className="my-3" />
            <div className="flex items-center justify-between">
              <span className="font-extrabold" style={{ color: C.navy }}>Total</span>
              <span className="font-extrabold text-lg" style={{ color: C.navy }}>{fmt(totals.total)}</span>
            </div>

            <PillButton full className="mt-4" disabled={!validation.ok || !cartLines.length} onClick={() => nav("checkout")}>
              {validation.ok ? "Proceed to Checkout" : "Resolve issues to continue"}
            </PillButton>

            {requiresPrescription && (
              <p className="text-[11px] mt-2 flex items-center gap-1.5" style={{ color: C.muted }}>
                <ShieldCheck size={12} /> Prescription items are checked by a pharmacist before dispatch.
              </p>
            )}
          </div>

        </aside>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="You might also need" />
          <ProductRail products={suggestions} onOpen={(id) => nav("product", { productId: id })} />
        </section>
      )}
    </Page>
  );
}

function Row({ label, value, tone }) {
  const C = useC();
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm" style={{ color: C.muted }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: tone || C.navy }}>{value}</span>
    </div>
  );
}
