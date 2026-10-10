/* Pure cart rules for the till — no React, no network. Unit-tested in posCart.test.js.

   The SERVER decides every price, tax, total and stock level (backend/src/domain/posTotals.js + the sale transaction). Everything here is
   what the cashier SEES while building the sale: it is deliberately a line-for-line mirror of that arithmetic (integer cents, discount shared
   across lines by largest remainder, tax on the discounted amount) and posCart.parity.test.js runs both on thousands of random carts so they
   cannot drift apart. The request also carries `expectedTotal`: if the server's total ever differs, the sale is refused and the real total shown. */

export const MAX_QTY = 10_000;
export const MAX_CASHIER_DISCOUNT_PERCENT = 20; // display hint only; the server enforces it

const cents = (n) => Math.round(Number(n) * 100);
const units = (c) => c / 100;

/** A quantity from anything a cashier (or a scanner, or a paste) might produce → a whole number 1…MAX_QTY, or null. Never 0, negative, NaN, Infinity or a fraction. */
export function parseQty(raw) {
  let n;
  if (typeof raw === "number") n = raw;
  else { const t = String(raw ?? "").trim(); if (!/^\d+$/.test(t)) return null; n = Number(t); }
  return Number.isSafeInteger(n) && n >= 1 && n <= MAX_QTY ? n : null;
}

export const lineKey = (productId, variantId, batch) => `${productId}:${variantId || "-"}:${batch || "-"}`;

/**
 * Adds one unit of a product, or raises an existing line by one.
 * `line` = { productId, variantId, batch, name, label, unit, sku, unitPrice, taxPercent, cap }   (cap = units the screen believes are sellable)
 * → { cart, result: "added" | "incremented" | "out" | "limit", qty }       (the cart is returned unchanged unless added/incremented)
 */
export function addLine(cart, line) {
  const key = lineKey(line.productId, line.variantId, line.batch);
  const cap = Number.isFinite(line.cap) ? Math.max(0, Math.floor(line.cap)) : MAX_QTY;
  const at = cart.findIndex((l) => l.key === key);
  if (at === -1) {
    if (cap < 1) return { cart, result: "out", qty: 0 };
    return { cart: [...cart, { ...line, key, cap, qty: 1 }], result: "added", qty: 1 };
  }
  const cur = cart[at];
  const limit = Math.min(cap, MAX_QTY);
  if (cur.qty + 1 > limit) return { cart, result: "limit", qty: cur.qty };
  return { cart: cart.map((l, i) => (i === at ? { ...l, cap, qty: l.qty + 1 } : l)), result: "incremented", qty: cur.qty + 1 };
}

/** Sets a line to an exact quantity typed/pasted by the cashier. Invalid input (0, negative, NaN, text, fractions) changes nothing. */
export function setLineQty(cart, key, raw) {
  const q = parseQty(raw);
  const line = cart.find((l) => l.key === key);
  if (q == null || !line) return { cart, result: "invalid", qty: line?.qty ?? 0 };
  if (q > line.cap) return { cart: cart.map((l) => (l.key === key ? { ...l, qty: line.cap } : l)), result: "limit", qty: line.cap };
  return { cart: cart.map((l) => (l.key === key ? { ...l, qty: q } : l)), result: "ok", qty: q };
}

/** The +/− buttons. Going below 1 removes the line (an explicit gesture), going above the cap holds at the cap. */
export function stepLine(cart, key, delta) {
  const line = cart.find((l) => l.key === key);
  if (!line) return { cart, result: "invalid", qty: 0 };
  const next = line.qty + delta;
  if (next < 1) return { cart: cart.filter((l) => l.key !== key), result: "removed", qty: 0 };
  return setLineQty(cart, key, next);
}
export const removeLine = (cart, key) => cart.filter((l) => l.key !== key);

/** After a stock refresh: lower a line's cap, and pull its qty down to what is really there (dropping it if nothing is). */
export function applyStock(cart, key, available) {
  const cap = Math.max(0, Math.floor(available));
  return cart.flatMap((l) => (l.key !== key ? [l] : cap < 1 ? [] : [{ ...l, cap, qty: Math.min(l.qty, cap) }]));
}

/** Largest-remainder split of `total` cents across `weights` (sums exactly). */
function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (total === 0 || sum === 0) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum);
  const base = exact.map(Math.floor);
  let left = total - base.reduce((a, b) => a + b, 0);
  for (const [, i] of exact.map((x, i) => [x - base[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1])) { if (left <= 0) break; base[i] += 1; left -= 1; }
  return base;
}

/** What the screen shows. → { subtotal, discount, tax, total, error } (error: why the discount can't apply; totals then ignore it). */
export function previewTotals(cart, discount) {
  const gross = cart.map((l) => cents(l.unitPrice) * l.qty);
  const subtotal = gross.reduce((a, b) => a + b, 0);
  let d = 0; let error = null;
  if (discount) {
    const v = Number(discount.value);
    if (discount.type === "percent") {
      if (!Number.isFinite(v) || v <= 0 || v > 100) error = "A percentage discount must be between 0 and 100.";
      else d = Math.round((subtotal * v) / 100);
    } else if (discount.type === "fixed") {
      if (!Number.isFinite(v) || v <= 0) error = "Enter a discount amount greater than zero.";
      else d = cents(v);
    }
    if (!error && d > subtotal) error = "The discount can't be more than the sale amount.";
    if (error) d = 0;
  }
  const shares = allocate(d, gross);
  const tax = cart.reduce((a, l, i) => a + Math.round(((gross[i] - shares[i]) * (Number(l.taxPercent) || 0)) / 100), 0);
  return { subtotal: units(subtotal), discount: units(d), tax: units(tax), total: units(subtotal - d + tax), error };
}

/** The discount box → a request value. Empty → no discount; garbage → an error message (never sent). */
export function parseDiscount(type, raw) {
  const t = String(raw ?? "").trim();
  if (t === "") return { discount: null, error: null };
  if (!/^\d*\.?\d+$/.test(t)) return { discount: null, error: "Enter a valid discount." };
  const value = Number(t);
  if (!Number.isFinite(value) || value <= 0) return { discount: null, error: "Enter a discount greater than zero." };
  if (type === "percent" && value > 100) return { discount: null, error: "A percentage discount can't exceed 100." };
  return { discount: { type, value }, error: null };
}

/** Cash tendered → change. `received` null while the field is empty/invalid. */
export function cashChange(total, rawReceived) {
  const t = String(rawReceived ?? "").trim();
  if (!/^\d*\.?\d+$/.test(t)) return { received: null, change: 0, short: 0, ok: total === 0 };
  const received = Number(t);
  const short = Math.max(0, units(cents(total) - cents(received)));
  return { received, change: short > 0 ? 0 : units(cents(received) - cents(total)), short, ok: short === 0 };
}

/** Round-up tender suggestions that make sense for `total` (exact first, then the next notes up). */
export function quickTenders(total) {
  const out = [Math.ceil(total * 100) / 100];
  for (const step of [10, 50, 100, 500, 1000]) { const v = Math.ceil(total / step) * step; if (v > total && !out.includes(v)) out.push(v); }
  return out.slice(0, 5);
}

/** A fresh id for ONE sale attempt, reused only for retries of that same attempt (the server turns it into "at most one sale"). */
export function newRequestId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replaceAll("-", "");
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes); else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The request body for POST /pos/sale from the cart — only WHAT is sold; no prices or taxes are sent as truth. */
export function buildSaleRequest({ store, cart, discount, customerName, payment, received, expectedTotal, idempotencyKey }) {
  return {
    branch: store,
    items: cart.map((l) => ({ productId: l.productId, ...(l.variantId ? { variantId: l.variantId } : {}), qty: l.qty })),
    paymentMethod: payment,
    ...(payment === "cash" && received != null ? { amountReceived: received } : {}),
    ...(discount ? { discount } : {}),
    ...(customerName?.trim() ? { customerName: customerName.trim().slice(0, 100) } : {}),
    expectedTotal,
    idempotencyKey,
  };
}
