import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Sheet, Divider, InlineNotice } from "../components/shared/ui.jsx";
import { Check, X, Store, Boxes } from "../components/shared/Icon.jsx";
import { sellerEarnings, sellerListings } from "../utils/sellerOrders.js";
import { fmt } from "../utils/format.js";

/** Platform-side seller management: approve applications, review pending
    listings, and see performance across every third-party seller. */
export default function AdminSellers() {
  const { sellers, products, orders, dispatch, toast, session, commerce, catalog } = useApp();
  const C = useC();
  const [review, setReview] = useState(null);

  const pendingListings = products.filter((p) => p.status === "pending_review");
  const pendingSellers = sellers.filter((s) => s.status === "pending");
  const activeSellers = sellers.filter((s) => s.status !== "pending");

  const setSellerStatus = async (id, status) => {
    try {
      await commerce.setSellerStatus(id, status);
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: `Seller ${status}`, detail: id } });
      toast(`Seller ${status}`);
    } catch (err) {
      toast(err.message || "Couldn't change that seller's status", "danger");
    }
  };

  const decideListing = async (p, status) => {
    try {
      await catalog.updateProduct({ ...p, status });
      dispatch({ type: "AUDIT", entry: { actor: session.user.name, action: status === "active" ? "Listing approved" : "Listing rejected", detail: p.name } });
      setReview(null);
      toast(status === "active" ? "Listing is now live" : "Listing rejected");
    } catch (err) {
      toast(err.message || "Couldn't save that decision", "danger");
    }
  };

  return (
    <div className="space-y-5">
      {pendingSellers.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Applications</p>
          {pendingSellers.map((s) => (
            <div key={s.id} className="rounded-2xl p-4 flex items-center gap-3 mb-2" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs" style={{ background: C.mint, color: C.primary }}>
                {s.name.slice(0, 2).toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm" style={{ color: C.navy }}>{s.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{s.contactEmail} · applied {s.joinedAt}</p>
              </div>
              <PillButton size="sm" variant="danger" onClick={() => setSellerStatus(s.id, "rejected")}><X size={13} /></PillButton>
              <PillButton size="sm" onClick={() => setSellerStatus(s.id, "active")}><Check size={13} /> Approve</PillButton>
            </div>
          ))}
        </div>
      )}

      {pendingListings.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Listings awaiting review ({pendingListings.length})</p>
          {pendingListings.map((p) => (
            <button key={p.id} onClick={() => setReview(p)} className="w-full rounded-2xl p-4 flex items-center gap-3 mb-2 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}><Boxes size={16} style={{ color: C.primary }} /></span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{p.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{fmt(p.salePrice ?? p.price)} · SKU {p.sku}</p>
              </div>
              <Badge tone="warn">Review</Badge>
            </button>
          ))}
        </div>
      )}

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>All sellers ({activeSellers.length})</p>
        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          {activeSellers.map((s, i) => {
            const earnings = sellerEarnings(orders, products, s);
            const listingCount = sellerListings(products, s.id).length;
            return (
              <div key={s.id} className="flex items-center gap-3 p-3.5" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs" style={{ background: C.mint, color: C.primary }}>
                  {s.name.slice(0, 2).toUpperCase()}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{s.name}</p>
                    {s.firstParty && <Badge tone="mint">Official</Badge>}
                  </div>
                  <p className="text-[11px]" style={{ color: C.muted }}>{listingCount} listings · {s.commissionRate}% commission</p>
                </div>
                <div className="text-right shrink-0 hidden sm:block">
                  <p className="text-sm font-bold" style={{ color: C.navy }}>{fmt(earnings.gross)}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>gross sales</p>
                </div>
                <Badge tone={s.status === "active" ? "ok" : "danger"}>{s.status}</Badge>
                {!s.firstParty && (
                  <button onClick={() => setSellerStatus(s.id, s.status === "active" ? "suspended" : "active")}
                    className="text-[11px] font-bold px-2 shrink-0" style={{ color: s.status === "active" ? "#E0546A" : C.primary }}>
                    {s.status === "active" ? "Suspend" : "Reinstate"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Sheet open={!!review} onClose={() => setReview(null)} title="Review listing"
        footer={
          <div className="flex gap-3">
            <PillButton variant="danger" className="flex-1" onClick={() => decideListing(review, "rejected")}><X size={14} /> Reject</PillButton>
            <PillButton className="flex-1" onClick={() => decideListing(review, "active")}><Check size={14} /> Approve</PillButton>
          </div>
        }>
        {review && (
          <div className="space-y-3">
            <p className="font-bold text-base" style={{ color: C.navy }}>{review.name}</p>
            <p className="text-sm" style={{ color: C.muted }}>{review.description}</p>
            <Divider />
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.muted }}>Price</span><span className="font-bold" style={{ color: C.navy }}>{fmt(review.salePrice ?? review.price)}</span></div>
            <div className="flex items-center justify-between text-sm"><span style={{ color: C.muted }}>SKU</span><span className="font-bold" style={{ color: C.navy }}>{review.sku}</span></div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
