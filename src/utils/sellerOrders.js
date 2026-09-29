import { productById } from "../data/products.js";
import { sellerForProduct } from "../data/sellers.js";

const round = (n) => Math.round(n * 100) / 100;

/**
 * Splits a marketplace order into the slice that belongs to one seller.
 * An order can contain items from several sellers (and Vyra Retail);
 * each seller only ever sees their own lines and their own subtotal.
 */
export function sellerSlice(order, products, sellerId) {
  const items = order.items
    .map((it) => ({ ...it, product: productById(it.productId, products) }))
    .filter((it) => it.product && sellerForProduct(it.product) === sellerId);
  if (!items.length) return null;
  const subtotal = round(items.reduce((s, it) => s + it.unitPrice * it.qty, 0));
  return { order, items, subtotal };
}

export function ordersForSeller(orders, products, sellerId) {
  return orders.map((o) => sellerSlice(o, products, sellerId)).filter(Boolean);
}

/**
 * Decision D3 (finding #4): a seller is owed money for DELIVERED orders only, net of commission. Orders still
 * in flight are reported separately (`pendingGross`) so the dashboard can show them without ever counting
 * them as earned — the old version counted every non-cancelled order, so a seller could "earn" (and request a
 * payout on) an order that was later returned or never delivered. The server enforces the same rule
 * independently when a payout is requested (sellers.repository#availableBalance).
 */
export function sellerEarnings(orders, products, seller) {
  const slices = ordersForSeller(orders, products, seller.id);
  const delivered = slices.filter((s) => s.order.status === "delivered");
  const inFlight = slices.filter((s) => !["delivered", "cancelled", "returned"].includes(s.order.status));
  const gross = round(delivered.reduce((s, x) => s + x.subtotal, 0));
  const commission = round(gross * (seller.commissionRate / 100));
  const net = round(gross - commission);
  return { gross, commission, net, orderCount: delivered.length, deliveredGross: gross, pendingGross: round(inFlight.reduce((s, x) => s + x.subtotal, 0)), pendingCount: inFlight.length };
}

export function sellerListings(products, sellerId) {
  return products.filter((p) => sellerForProduct(p) === sellerId);
}
