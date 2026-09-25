import { PRODUCTS, productById } from "../data/products.js";
import { categoryPath } from "../data/categories.js";
import { couponByCode } from "../data/promotions.js";
import { DELIVERY_OPTIONS } from "../data/stores.js";

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

const inScope = (product, scope) => {
  if (!scope || scope.type === "all") return true;
  if (scope.type === "brand") return product.brandId === scope.id;
  if (scope.type === "category") return categoryPath(product.categoryId).some((c) => c && c.id === scope.id);
  if (scope.type === "product") return product.id === scope.id;
  return false;
};

/**
 * Evaluates a coupon against cart lines.
 * Returns { ok, discount, reason }.
 */
export function evaluateCoupon(code, lines, { isFirstOrder = false } = {}) {
  const coupon = couponByCode(code);
  if (!coupon) return { ok: false, discount: 0, reason: "That code isn't recognised." };
  if (coupon.firstOrderOnly && !isFirstOrder) return { ok: false, discount: 0, reason: "This code is for first orders only." };

  const eligible = lines.filter((l) => inScope(l.product, coupon.scope));
  const eligibleTotal = eligible.reduce((s, l) => s + l.lineTotal, 0);
  const cartTotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  if (cartTotal < (coupon.minOrder || 0))
    return { ok: false, discount: 0, reason: `Spend ${(coupon.minOrder - cartTotal).toFixed(2)} more to use this code.` };
  if (eligibleTotal <= 0) return { ok: false, discount: 0, reason: "No items in your cart match this offer." };

  let discount = coupon.type === "percent" ? (eligibleTotal * coupon.value) / 100 : Math.min(coupon.value, eligibleTotal);
  if (coupon.maxDiscount) discount = Math.min(discount, coupon.maxDiscount);
  return { ok: true, discount: Math.round(discount * 100) / 100, coupon, reason: coupon.label };
}

/** Full order maths for cart + checkout. One source of truth. */
export function computeTotals(lines, { couponCode = null, deliveryOptionId = "standard", isFirstOrder = false } = {}) {
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const savings = lines.reduce((s, l) => s + (l.mrp - l.unitPrice) * l.qty, 0);

  let discount = 0, couponResult = null;
  if (couponCode) {
    couponResult = evaluateCoupon(couponCode, lines, { isFirstOrder });
    if (couponResult.ok) discount = couponResult.discount;
  }

  const taxable = Math.max(subtotal - discount, 0);
  const tax = Math.round(lines.reduce((s, l) => s + l.lineTotal * ((l.product.tax || 0) / 100), 0) * 100) / 100;

  const option = DELIVERY_OPTIONS.find((d) => d.id === deliveryOptionId) || DELIVERY_OPTIONS[1];
  let deliveryFee = option.fee;
  if (option.freeAbove && taxable >= option.freeAbove) deliveryFee = 0;

  const total = Math.max(taxable + tax + deliveryFee, 0);
  return {
    subtotal: round(subtotal), savings: round(savings), discount: round(discount),
    tax: round(tax), deliveryFee: round(deliveryFee), total: round(total),
    couponResult, deliveryOption: option,
  };
}
const round = (n) => Math.round(n * 100) / 100;

/** Rebuilds order lines (used by Buy Again with current prices). */
export function linesFromItems(items, storeId) {
  return items.map((it) => {
    const product = productById(it.productId);
    if (!product) return null;
    const { price, mrp } = priceOf(product, it.variantId);
    return { key: `${it.productId}:${it.variantId || "-"}`, product, variantId: it.variantId, qty: it.qty, unitPrice: price, mrp, lineTotal: round(price * it.qty) };
  }).filter(Boolean);
}

export const flashDeals = () => PRODUCTS.filter((p) => (p.tags || []).includes("flash"));
