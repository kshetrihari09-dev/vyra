import { useMemo } from "react";
import { useApp } from "../store/AppContext.jsx";
import { topCategories, categoryTreeIds } from "../data/categories.js";
import { STORES } from "../data/stores.js";
import { productById } from "../data/products.js";
import { sortProducts } from "../utils/search.js";
import { stockFor } from "../utils/inventory.js";

/**
 * Everything the home screen shows, derived from the app's real data (API-loaded products, orders, views, categories, store).
 * Shared by the desktop/tablet home and the mobile home so both always agree. Moved verbatim from Home.jsx — same rules, same slices.
 */
export function useHomeData() {
  const { products, activeProducts, categories, storeId, myOrders: orders, recentlyViewed } = useApp();
  const store = STORES.find((s) => s.id === storeId);

  const tops = useMemo(() => topCategories(categories), [categories]);
  const byTag = (tag) => activeProducts.filter((p) => (p.tags || []).includes(tag));

  const sections = useMemo(() => ({
    popular: byTag("popular").slice(0, 10),
    flash: byTag("flash").slice(0, 10),
    best: sortProducts(activeProducts, "bestselling").slice(0, 10),
    fresh: sortProducts(activeProducts, "newest").slice(0, 10),
    near: byTag("near").filter((p) => stockFor(p, null, storeId) > 0).slice(0, 10),
  }), [activeProducts, storeId]); // eslint-disable-line react-hooks/exhaustive-deps

  /* "Recommended" comes from what the customer has actually bought and viewed — same categories, excluding things already seen. */
  const recommended = useMemo(() => {
    const seen = new Set(recentlyViewed);
    const affinity = new Set();
    orders.slice(0, 3).forEach((o) => o.items.forEach((i) => {
      const p = productById(i.productId, products);
      if (p) affinity.add(p.categoryId);
    }));
    recentlyViewed.forEach((id) => { const p = productById(id, products); if (p) affinity.add(p.categoryId); });
    const roots = [...affinity].flatMap((id) => categoryTreeIds(id, categories));
    return activeProducts.filter((p) => roots.includes(p.categoryId) && !seen.has(p.id)).sort((a, b) => b.rating - a.rating).slice(0, 10);
  }, [orders, recentlyViewed, activeProducts, categories, products]);

  const buyAgain = useMemo(() => {
    const ids = [];
    orders.forEach((o) => o.items.forEach((i) => { if (!ids.includes(i.productId)) ids.push(i.productId); }));
    return ids.map((id) => productById(id, products)).filter(Boolean).slice(0, 10);
  }, [orders, products]);

  const viewed = useMemo(() => recentlyViewed.map((id) => productById(id, products)).filter(Boolean), [recentlyViewed, products]);

  return { store, tops, sections, recommended, buyAgain, viewed, productCount: activeProducts.length };
}
