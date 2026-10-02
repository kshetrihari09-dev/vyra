/* Pure functions that turn the marketplace's real state (products, orders,
   stock movements) into what the seller dashboard shows. Nothing here stores
   anything: every number is derived, so it can never drift from the orders. */

import { LOW_STOCK, stockFor } from "../utils/inventory.js";
import { priceOf } from "../utils/pricing.js";
import { STORES } from "../data/stores.js";
import { resolveCategory } from "../data/categories.js";
import { ordersForSeller } from "../utils/sellerOrders.js";
import { sellerStatusOf, paymentStatusOf, deliveryStatusOf, isRevenueOrder, isOpenOrder } from "./orderStatus.js";

const round = (n) => Math.round(n * 100) / 100;

/* -------------------------------- products -------------------------------- */
export const totalStock = (product, variantId = null) =>
  STORES.reduce((s, st) => s + stockFor(product, variantId, st.id), 0);

export const minStockOf = (product) => (Number.isFinite(product.minStock) ? product.minStock : LOW_STOCK);

/** Purchase price: what the seller entered, else the weighted cost of received batches. */
export function unitCostOf(product) {
  if (Number.isFinite(product.costPrice) && product.costPrice > 0) return product.costPrice;
  const b = (product.batches || []).filter((x) => x.cost > 0 && x.qty > 0);
  if (!b.length) return null;
  const qty = b.reduce((s, x) => s + x.qty, 0);
  return round(b.reduce((s, x) => s + x.cost * x.qty, 0) / qty);
}

export const STOCK_STATUS = {
  active: { key: "active", label: "Active", tone: "ok" },
  low: { key: "low", label: "Low stock", tone: "warn" },
  out: { key: "out", label: "Out of stock", tone: "danger" },
  inactive: { key: "inactive", label: "Inactive", tone: "neutral" },
  review: { key: "review", label: "In review", tone: "info" },
};

export function productStatus(product, qty = totalStock(product)) {
  if (product.status === "pending_review") return STOCK_STATUS.review;
  if (product.status === "inactive") return STOCK_STATUS.inactive;
  if (qty <= 0) return STOCK_STATUS.out;
  if (qty <= minStockOf(product)) return STOCK_STATUS.low;
  return STOCK_STATUS.active;
}

/** Discount is derived from MRP vs selling price — never stored twice. */
export const discountPct = (product) => priceOf(product).discountPct;

/* --------------------------------- orders --------------------------------- */
export function customerOf(order) {
  if (order.customer) return order.customer;
  const s = order.shipTo;
  if (s) return { id: `ship-${s.phone || s.name}`, name: s.name, phone: s.phone || null, email: null };
  return { id: "walk-in", name: "Walk-in customer", phone: null, email: null };
}

export function buildOrderRows(orders, products, sellerId) {
  return ordersForSeller(orders, products, sellerId).map(({ order, items, subtotal, soleSeller }) => ({
    id: order.id, number: order.number, order, items, subtotal,
    units: items.reduce((s, i) => s + i.qty, 0),
    customer: customerOf(order), placedAt: order.placedAt,
    status: sellerStatusOf(order.status), payment: paymentStatusOf(order), delivery: deliveryStatusOf(order),
    soleSeller,
  })).sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}

/* --------------------------------- dates ---------------------------------- */
export const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const startOfWeek = (d) => { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); return x; };
const startOfMonth = (d) => { const x = startOfDay(d); x.setDate(1); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const sameDay = (a, b) => startOfDay(a).getTime() === startOfDay(b).getTime();
const fmtDay = (d) => d.toLocaleDateString(undefined, { day: "numeric", month: "short" });

const GRAN = {
  day: { start: startOfDay, step: (d, n) => addDays(d, n), label: (d) => fmtDay(d) },
  week: { start: startOfWeek, step: (d, n) => addDays(d, 7 * n), label: (d) => `Wk of ${fmtDay(d)}` },
  month: { start: startOfMonth, step: (d, n) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }, label: (d) => d.toLocaleDateString(undefined, { month: "short", year: "2-digit" }) },
};

/** Revenue / order buckets, oldest → newest, always `count` long (empty buckets are zeros). */
export function salesSeries(rows, granularity = "day", count = 14, now = new Date()) {
  const g = GRAN[granularity];
  const last = g.start(now);
  const buckets = Array.from({ length: count }, (_, i) => {
    const start = g.step(last, -(count - 1 - i));
    return { start, label: g.label(start), revenue: 0, orders: 0, units: 0, cancelled: 0 };
  });
  const first = buckets[0].start.getTime();
  rows.forEach((r) => {
    const t = new Date(r.placedAt);
    const idx = buckets.findIndex((b, i) => t >= b.start && (i === buckets.length - 1 || t < buckets[i + 1].start));
    if (t.getTime() < first || idx < 0) return;
    const b = buckets[idx];
    if (isRevenueOrder(r.order.status)) { b.revenue += r.subtotal; b.orders += 1; b.units += r.units; }
    else b.cancelled += 1;
  });
  buckets.forEach((b) => { b.revenue = round(b.revenue); b.aov = b.orders ? round(b.revenue / b.orders) : 0; });
  return buckets;
}

export function periodTotals(buckets) {
  const revenue = round(buckets.reduce((s, b) => s + b.revenue, 0));
  const orders = buckets.reduce((s, b) => s + b.orders, 0);
  return { revenue, orders, aov: orders ? round(revenue / orders) : 0, units: buckets.reduce((s, b) => s + b.units, 0), cancelled: buckets.reduce((s, b) => s + b.cancelled, 0) };
}

export function dashboardKpis(rows, now = new Date()) {
  const today = startOfDay(now), yesterday = addDays(today, -1);
  const on = (day) => rows.filter((r) => sameDay(r.placedAt, day) && isRevenueOrder(r.order.status));
  const t = on(today), y = on(yesterday);
  const sum = (list) => round(list.reduce((s, r) => s + r.subtotal, 0));
  return {
    todaySales: sum(t), yesterdaySales: sum(y), todayOrders: t.length, yesterdayOrders: y.length,
    pending: rows.filter((r) => isOpenOrder(r.order.status)).length,
    pendingNew: rows.filter((r) => r.status.key === "pending").length,
    customers: new Set(rows.map((r) => r.customer.id)).size,
  };
}

export function pipelineCounts(rows) {
  const keys = ["pending", "confirmed", "preparing", "ready", "out"];
  return keys.map((k) => ({ key: k, count: rows.filter((r) => r.status.key === k).length }));
}

/* ----------------------------- product / category ---------------------------- */
export function topProducts(rows, limit = 5, since = null) {
  const map = new Map();
  rows.forEach((r) => {
    if (!isRevenueOrder(r.order.status)) return;
    if (since && new Date(r.placedAt) < since) return;
    r.items.forEach((it) => {
      const m = map.get(it.productId) || { product: it.product, units: 0, revenue: 0 };
      m.units += it.qty; m.revenue = round(m.revenue + it.unitPrice * it.qty);
      map.set(it.productId, m);
    });
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, limit);
}

export function categoryPerformance(rows, categories, since = null) {
  const map = new Map();
  rows.forEach((r) => {
    if (!isRevenueOrder(r.order.status)) return;
    if (since && new Date(r.placedAt) < since) return;
    r.items.forEach((it) => {
      const root = resolveCategory(it.product.categoryId, categories)?.root;
      const key = root?.id || "other";
      const m = map.get(key) || { id: key, name: root?.name || "Other", units: 0, revenue: 0, orders: new Set() };
      m.units += it.qty; m.revenue = round(m.revenue + it.unitPrice * it.qty); m.orders.add(r.id);
      map.set(key, m);
    });
  });
  return [...map.values()].map((m) => ({ ...m, orders: m.orders.size })).sort((a, b) => b.revenue - a.revenue);
}

export function paymentSplit(rows, since = null) {
  const map = new Map();
  rows.forEach((r) => {
    if (!isRevenueOrder(r.order.status)) return;
    if (since && new Date(r.placedAt) < since) return;
    const k = r.order.paymentMethod || "cod";
    const m = map.get(k) || { method: k, orders: 0, revenue: 0 };
    m.orders += 1; m.revenue = round(m.revenue + r.subtotal); map.set(k, m);
  });
  return [...map.values()].sort((a, b) => b.revenue - a.revenue);
}

/* -------------------------------- customers -------------------------------- */
export function buildCustomers(rows, now = new Date()) {
  const map = new Map();
  rows.forEach((r) => {
    const c = r.customer;
    const m = map.get(c.id) || { ...c, orders: 0, spend: 0, last: null, rows: [] };
    m.rows.push(r);
    if (r.order.status !== "cancelled") m.orders += 1;
    if (isRevenueOrder(r.order.status)) m.spend = round(m.spend + r.subtotal);
    if (!m.last || new Date(r.placedAt) > new Date(m.last)) m.last = r.placedAt;
    map.set(c.id, m);
  });
  return [...map.values()].map((m) => {
    const daysSince = (now - new Date(m.last)) / 864e5;
    const status = m.orders <= 1 && daysSince <= 14 ? "New" : daysSince <= 30 ? "Active" : "Inactive";
    return { ...m, status };
  }).sort((a, b) => b.spend - a.spend);
}

/* -------------------------------- inventory -------------------------------- */
export function inventoryRowsFor(listings, movements) {
  const lastMove = new Map();
  movements.forEach((m) => {
    const k = `${m.productId}:${m.variantId || "-"}`;
    if (!lastMove.has(k) || new Date(m.at) > new Date(lastMove.get(k))) lastMove.set(k, m.at);
  });
  const rows = [];
  listings.forEach((p) => {
    const cost = unitCostOf(p);
    const variants = p.variants?.length ? p.variants : [null];
    variants.forEach((v) => {
      const qty = totalStock(p, v?.id || null);
      const price = priceOf(p, v?.id || null).price;
      const byStore = Object.fromEntries(STORES.map((s) => [s.id, stockFor(p, v?.id || null, s.id)]));
      rows.push({
        key: `${p.id}:${v?.id || "-"}`, product: p, variant: v,
        name: v ? `${p.name} — ${v.label}` : p.name, sku: v?.sku || p.sku,
        qty, byStore, min: minStockOf(p), cost, price,
        value: round(qty * (cost ?? price)), valueBasis: cost != null ? "cost" : "retail",
        status: productStatus(p, qty),
        updatedAt: lastMove.get(`${p.id}:${v?.id || "-"}`) || p.updatedAt || null,
      });
    });
  });
  return rows;
}

export function inventoryTotals(rows) {
  const atRetail = round(rows.reduce((s, r) => s + r.qty * r.price, 0));
  const costed = rows.filter((r) => r.cost != null);
  return {
    atCost: round(costed.reduce((s, r) => s + r.qty * r.cost, 0)),
    atRetail,
    units: rows.reduce((s, r) => s + r.qty, 0),
    missingCost: rows.length - costed.length,
    low: rows.filter((r) => r.status.key === "low").length,
    out: rows.filter((r) => r.status.key === "out").length,
  };
}
