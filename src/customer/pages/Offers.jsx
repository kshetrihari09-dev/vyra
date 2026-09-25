import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, SectionHeader, Badge, PillButton } from "../../components/shared/ui.jsx";
import { ProductGrid } from "../components/ProductCard.jsx";
import { Tag, Percent, Clock } from "../../components/shared/Icon.jsx";
import { COUPONS, PROMOTIONS } from "../../data/promotions.js";
import { priceOf } from "../../utils/pricing.js";

export default function Offers({ nav }) {
  const { products, toast } = useApp();
  const C = useC();
  const deals = products.filter((p) => priceOf(p).discountPct > 0).sort((a, b) => priceOf(b).discountPct - priceOf(a).discountPct);

  return (
    <Page wide>
      <PageHeader title="Offers & Coupons" subtitle={`${deals.length} products on offer`} onBack={() => nav("home")} />

      <div className="px-4 md:px-0 grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
        {COUPONS.map((c) => (
          <div key={c.code} className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px dashed ${C.primary}` }}>
            <span className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
              <Tag size={19} style={{ color: C.primary }} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="font-extrabold text-sm" style={{ color: C.navy }}>{c.code}</p>
              <p className="text-xs" style={{ color: C.muted }}>{c.label}</p>
              {c.minOrder > 0 && <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>Min. order ${c.minOrder}</p>}
            </div>
            <PillButton size="sm" variant="ghost" onClick={() => { navigator.clipboard?.writeText(c.code); toast(`Code ${c.code} copied`); }}>Copy</PillButton>
          </div>
        ))}
      </div>

      <div className="px-4 md:px-0 mb-6">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.navy }}>
          <Clock size={18} color="#fff" />
          <div className="flex-1">
            <p className="text-white font-bold text-sm">{PROMOTIONS[0].name} — {PROMOTIONS[0].label}</p>
            <p className="text-white/70 text-xs">Ends at midnight tonight</p>
          </div>
        </div>
      </div>

      <SectionHeader title="All deals" subtitle="Biggest discounts first" />
      <div className="px-4 md:px-0">
        <ProductGrid products={deals} onOpen={(id) => nav("product", { productId: id })} />
      </div>
    </Page>
  );
}
