import { PRODUCTS, productById } from "../data/products.js";

/** Effective price for a product, honouring the selected variant. */
export function priceOf(product, variantId = null) {
  const v = variantId ? (product.variants || []).find((x) => x.id === variantId) : null;
  const mrp = v?.price ?? product.price;
  const sale = v?.salePrice ?? product.salePrice ?? mrp;
  return { mrp, price: sale, discountPct: mrp > sale ? Math.round(((mrp - sale) / mrp) * 100) : 0 };
}

export const defaultVariantId = (product) => {
  if (!product?.variants?.length) return null;
  const inStock = product.variants.find((v) => Object.values(v.stock || {}).some((n) => n > 0));
  return (inStock || product.variants[0]).id;
};

const round = (n) => Math.round(n * 100) / 100;

export function linesFromItems(items, storeId) {
  return items.map((it) => {
    const product = productById(it.productId);
    if (!product) return null;
    const { price, mrp } = priceOf(product, it.variantId);
    return { key: `${it.productId}:${it.variantId || "-"}`, product, variantId: it.variantId, qty: it.qty, unitPrice: price, mrp, lineTotal: round(price * it.qty) };
  }).filter(Boolean);
}

export const flashDeals = () => PRODUCTS.filter((p) => (p.tags || []).includes("flash"));
