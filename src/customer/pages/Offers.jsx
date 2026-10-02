import React from "react";
import { useApp } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, SectionHeader } from "../../components/shared/ui.jsx";
import { ProductGrid } from "../components/ProductCard.jsx";
import { priceOf } from "../../utils/pricing.js";

export default function Offers({ nav }) {
  const { products } = useApp();
  const deals = products.filter((p) => priceOf(p).discountPct > 0).sort((a, b) => priceOf(b).discountPct - priceOf(a).discountPct);

  return (
    <Page wide>
      <PageHeader title="Offers" subtitle={`${deals.length} products on offer`} onBack={() => nav("home")} />

      <SectionHeader title="All deals" subtitle="Biggest discounts first" />
      <div className="px-4 md:px-0">
        <ProductGrid products={deals} onOpen={(id) => nav("product", { productId: id })} />
      </div>
    </Page>
  );
}
