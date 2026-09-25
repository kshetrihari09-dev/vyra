import React, { useState } from "react";
import { useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader } from "../../components/shared/ui.jsx";
import { SearchBar, useDebounced } from "../components/SearchBar.jsx";
import { ProductBrowser } from "../components/ProductBrowser.jsx";
import { brandById } from "../../data/brands.js";

export default function Search({ nav, params, query, setQuery }) {
  const C = useC();
  const debounced = useDebounced(query, 220);

  const [total, setTotal] = useState(null); // reported by the browser once the API answers

  const title = params.brandId ? brandById(params.brandId).name : debounced ? `Results for “${debounced}”` : "Search";

  return (
    <Page wide>
      <PageHeader title={title} subtitle={total == null ? "" : `${total} product${total === 1 ? "" : "s"}`} onBack={() => nav("home")} />
      <div className="px-4 md:px-0 mb-4 md:hidden">
        <SearchBar value={query} onChange={setQuery} autoFocus={!query}
          onPick={(s) => {
            if (s.type === "product") nav("product", { productId: s.id });
            else if (s.type === "category") nav("category", { categoryId: s.id });
            else setQuery(s.label);
          }} />
      </div>
      <ProductBrowser q={debounced} brandId={params.brandId} onTotal={setTotal} onOpen={(id) => nav("product", { productId: id })}
        emptyTitle={debounced ? `No results for “${debounced}”` : "Start typing to search"} />
    </Page>
  );
}
