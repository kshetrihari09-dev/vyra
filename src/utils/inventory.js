import { PRODUCTS } from "../data/products.js";
import { hasModule } from "../data/categories.js";

/** Stock for a product (or one of its variants) at a given store. */
export function stockFor(product, variantId, storeId) {
  if (!product) return 0;
  if (variantId) {
    const v = (product.variants || []).find((x) => x.id === variantId);
    return v ? (v.stock?.[storeId] ?? 0) : 0;
  }
  if (product.variants?.length) {
    return product.variants.reduce((s, v) => s + (v.stock?.[storeId] ?? 0), 0);
  }
  return product.stock?.[storeId] ?? 0;
}

export const LOW_STOCK = 10;

export function stockState(product, variantId, storeId) {
  const qty = stockFor(product, variantId, storeId);
  if (qty <= 0) return { level: "out", qty, label: "Out of stock" };
  if (qty <= LOW_STOCK) return { level: "low", qty, label: `Only ${qty} left` };
  return { level: "in", qty, label: "In stock" };
}

/** Available = on hand − reserved by open carts/orders. */
export function availability(product, variantId, storeId, reserved = 0) {
  const onHand = stockFor(product, variantId, storeId);
  return { onHand, reserved, available: Math.max(onHand - reserved, 0) };
}

/** Max a customer may add: bounded by stock and the product's own max. */
export function maxAddable(product, variantId, storeId) {
  return Math.min(stockFor(product, variantId, storeId), product.maxQty || 99);
}

/** First Expiry First Out — only for categories that carry the "batch" module. */
export function fefoBatches(product) {
  if (!product?.batches || !hasModule(product.categoryId, "batch")) return [];
  return [...product.batches].sort((a, b) => new Date(a.expiry) - new Date(b.expiry));
}

export const daysToExpiry = (iso) => Math.round((new Date(iso) - new Date()) / 864e5);

/** Expired batches are never allocated for a sale — this is the guard that
    keeps a POS checkout or an order from silently dispensing dead stock. */
export const sellableBatches = (product) => fefoBatches(product).filter((b) => daysToExpiry(b.expiry) >= 0);

export function batchStatus(expiry) {
  const days = daysToExpiry(expiry);
  if (days < 0) return { level: "expired", label: "Expired", days };
  if (days <= 30) return { level: "expiring", label: `Expires in ${days}d`, days };
  return { level: "ok", label: `${days}d to expiry`, days };
}

export function allocateFEFO(product, qty) {
  const picks = [];
  let remaining = qty;
  for (const b of sellableBatches(product)) {
    if (remaining <= 0) break;
    const take = Math.min(b.qty, remaining);
    picks.push({ batch: b.batch, expiry: b.expiry, qty: take });
    remaining -= take;
  }
  return { picks, shortfall: Math.max(remaining, 0) };
}

export const expiringSoon = (product, withinDays = 90) =>
  fefoBatches(product).filter((b) => { const d = daysToExpiry(b.expiry); return d >= 0 && d <= withinDays; });
export const expiredBatches = (product) => fefoBatches(product).filter((b) => daysToExpiry(b.expiry) < 0);

/** What's actually safe to sell right now — for batch-tracked products this
    excludes anything sitting in an expired batch, even if the raw stock
    counter hasn't been reconciled yet. */
export function sellableQty(product, storeId) {
  if (hasModule(product.categoryId, "batch") && product.batches?.length) {
    return sellableBatches(product).reduce((s, b) => s + b.qty, 0);
  }
  return stockFor(product, null, storeId);
}

/** Rows for the admin inventory table — derived, never duplicated. */
export function inventoryRows(storeId, products = PRODUCTS) {
  const rows = [];
  for (const p of products) {
    if (p.variants?.length) {
      for (const v of p.variants) {
        rows.push({ product: p, variant: v, sku: v.sku, onHand: v.stock?.[storeId] ?? 0, label: `${p.name} · ${v.label}` });
      }
    } else {
      rows.push({ product: p, variant: null, sku: p.sku, onHand: p.stock?.[storeId] ?? 0, label: p.name });
    }
  }
  return rows;
}
