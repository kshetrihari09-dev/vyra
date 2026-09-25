import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, EmptyState, PillButton, Badge, InlineNotice } from "../../components/shared/ui.jsx";
import { ProductGrid } from "../components/ProductCard.jsx";
import { CartItem } from "../components/CartItem.jsx";
import { Heart, Bell, TrendingUp, PackageCheck } from "../../components/shared/Icon.jsx";
import { priceOf } from "../../utils/pricing.js";
import { stockFor } from "../../utils/inventory.js";

export default function Wishlist({ nav }) {
  const { wishlist, products, savedLines, storeId, toast } = useApp();
  const C = useC();
  const items = wishlist.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const drops = items.filter((p) => priceOf(p).discountPct >= 20);
  const restocked = items.filter((p) => stockFor(p, null, storeId) > 0 && stockFor(p, null, storeId) <= 10);

  return (
    <Page wide>
      <PageHeader title="Wishlist" subtitle={`${items.length} saved`} onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-4">
        {drops.length > 0 && (
          <InlineNotice tone="warn" icon={TrendingUp}>
            {drops.length} wishlist item{drops.length > 1 ? "s have" : " has"} dropped 20% or more.
            <button className="font-bold underline ml-1" onClick={() => toast("Price-drop alerts are on")}>Keep alerts on</button>
          </InlineNotice>
        )}
        {restocked.length > 0 && (
          <InlineNotice tone="ok" icon={PackageCheck}>
            {restocked.length} item{restocked.length > 1 ? "s are" : " is"} back in stock but running low at your store.
          </InlineNotice>
        )}

        {items.length === 0 ? (
          <EmptyState icon={Heart} title="Nothing saved yet" message="Tap the heart on any product to keep it here." action="Browse products" onAction={() => nav("categories")} />
        ) : (
          <ProductGrid products={items} onOpen={(id) => nav("product", { productId: id })} />
        )}

        {savedLines.length > 0 && (
          <div className="pt-4">
            <h2 className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Saved for later</h2>
            <div className="space-y-3">
              {savedLines.map((l) => <CartItem key={l.key} line={l} saved onOpen={(id) => nav("product", { productId: id })} />)}
            </div>
          </div>
        )}
      </div>
    </Page>
  );
}
