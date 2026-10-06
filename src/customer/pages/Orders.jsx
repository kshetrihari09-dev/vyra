import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, EmptyState, Badge } from "../../components/shared/ui.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { Package, RotateCcw, ChevronRight } from "../../components/shared/Icon.jsx";
import { STATUS_STYLE } from "../components/OrderTimeline.jsx";
import { productById } from "../../data/products.js";
import { storeById } from "../../data/stores.js";
import { fmt, dateTimeLabel } from "../../utils/format.js";
import { stockFor } from "../../utils/inventory.js";

export default function Orders({ nav }) {
  const { myOrders: orders, products, storeId, dispatch, toast } = useApp();
  const C = useC();

  /* Reorder re-checks availability against current stock instead of blindly
     copying the old basket. */
  const reorder = (order) => {
    let added = 0, skipped = 0;
    order.items.forEach((it) => {
      const p = productById(it.productId, products);
      if (!p) { skipped++; return; }
      const available = stockFor(p, it.variantId, storeId);
      if (available <= 0) { skipped++; return; }
      dispatch({ type: "CART_ADD", productId: it.productId, variantId: it.variantId, qty: Math.min(it.qty, available) });
      added++;
    });
    toast(skipped ? `${added} items added · ${skipped} unavailable` : `${added} items added to cart`, skipped ? "danger" : "success");
    nav("cart");
  };

  if (!orders.length) {
    return (
      <Page>
        <PageHeader title="Your Orders" onBack={() => nav("profile")} />
        <EmptyState icon={Package} title="No orders yet" message="When you place an order it will appear here with live tracking." action="Start shopping" onAction={() => nav("home")} />
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title="Your Orders" subtitle={`${orders.length} orders`} onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-3">
        {orders.map((o) => {
          const style = STATUS_STYLE[o.status];
          return (
            <div key={o.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <button onClick={() => nav("orderDetails", { orderId: o.id })} className="w-full text-left">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="min-w-0">
                    <p className="font-extrabold text-sm" style={{ color: C.navy }}>{o.number}</p>
                    <p className="text-[11px]" style={{ color: C.muted }}>{dateTimeLabel(o.placedAt)} · {storeById(o.storeId).name}</p>
                  </div>
                  <Badge tone={style.tone}>{style.label}</Badge>
                </div>

                <div className="flex items-center gap-2 mb-3">
                  {o.items.slice(0, 4).map((it) => {
                    const p = productById(it.productId, products);
                    return p ? (
                      <span key={it.productId + (it.variantId || "")} className="w-12 h-12 rounded-xl overflow-hidden shrink-0" style={{ background: C.bg }}>
                        <ProductArt product={p} variantId={it.variantId} size={32} rounded={false} />
                      </span>
                    ) : null;
                  })}
                  {o.items.length > 4 && (
                    <span className="w-12 h-12 rounded-xl flex items-center justify-center text-xs font-bold shrink-0" style={{ background: C.mint, color: C.primary }}>
                      +{o.items.length - 4}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1 text-sm font-extrabold shrink-0" style={{ color: C.navy }}>
                    {fmt(o.totals.total)} <ChevronRight size={15} style={{ color: C.muted }} />
                  </span>
                </div>
              </button>

              <div className="flex gap-2">
                <PillButton size="sm" variant="outline" className="flex-1" onClick={() => reorder(o)}>
                  <RotateCcw size={13} /> Buy again
                </PillButton>
                <PillButton size="sm" variant="subtle" className="flex-1" onClick={() => (["delivered", "cancelled", "returned"].includes(o.status) ? nav("orderDetails", { orderId: o.id }) : nav("trackOrder", { orderId: o.id }))}>
                  {["delivered", "cancelled", "returned"].includes(o.status) ? "View details" : "Track order"}
                </PillButton>
              </div>
            </div>
          );
        })}
      </div>
    </Page>
  );
}
