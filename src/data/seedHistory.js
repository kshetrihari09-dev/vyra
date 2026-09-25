/* ==========================================================================
   DEMO SEED — order history for the marketplace.

   There is no backend in this build, so the seller dashboard needs orders to
   report on. This file generates ~6 weeks of past orders across every seller
   from the real product catalogue, other demo customers, and a fixed PRNG
   seed so the numbers are the same on every load. Dates are relative to load
   time so "today" always has activity.

   Customer-facing screens only show orders belonging to the signed-in
   customer, so none of this appears in a shopper's "Your Orders". Delete this
   file (and its import in AppContext) to start with a clean slate.
   ========================================================================== */
import { PRODUCTS } from "./products.js";
import { sellerForProduct } from "./sellers.js";
import { CUSTOMER } from "./seed.js";
import { priceOf } from "../utils/pricing.js";

export const SEED_CUSTOMERS = [
  { id: CUSTOMER.id, name: CUSTOMER.name, phone: CUSTOMER.phone, email: CUSTOMER.email },
  { id: "cus-1002", name: "Jordan Lee", phone: "+1 555 0214", email: "jordan.lee@example.com" },
  { id: "cus-1003", name: "Mei Lin", phone: "+1 555 0255", email: "mei.lin@example.com" },
  { id: "cus-1004", name: "Priya Nair", phone: "+1 555 0316", email: "priya.nair@example.com" },
  { id: "cus-1005", name: "Diego Alvarez", phone: "+1 555 0327", email: "diego.alvarez@example.com" },
  { id: "cus-1006", name: "Hannah Brooks", phone: "+1 555 0338", email: "hannah.brooks@example.com" },
  { id: "cus-1007", name: "Samir Qureshi", phone: "+1 555 0349", email: "samir.q@example.com" },
  { id: "cus-1008", name: "Chloe Martin", phone: "+1 555 0360", email: "chloe.martin@example.com" },
  { id: "cus-1009", name: "Tomás Rivera", phone: "+1 555 0371", email: "tomas.rivera@example.com" },
  { id: "cus-1010", name: "Aiko Tanaka", phone: "+1 555 0382", email: "aiko.tanaka@example.com" },
];

const STREETS = [
  ["24 Maple Court", "Central District", "10245"], ["7 Orchard Lane", "North Quarter", "10311"], ["112 Canal Street", "Central District", "10118"],
  ["58 Birchwood Avenue", "Riverside", "10402"], ["3 Harbour View", "Central District", "10201"], ["91 Elm Row", "North Quarter", "10377"],
  ["16 Foundry Road", "Riverside", "10456"], ["40 Linden Close", "Central District", "10230"], ["205 Station Road", "North Quarter", "10390"], ["12 Willow Walk", "Riverside", "10433"],
];

function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SELLER_WEIGHTS = [
  ["novatech-official", 3], ["fresh-grocers", 3], ["auralux-beauty", 2], ["urbanthread-apparel", 2],
  ["vyra-retail", 2], ["homecraft-living", 1], ["inkwell-stationery", 1], ["pawsome-pets", 1],
];
const PAYMENTS = ["card", "card", "card", "card", "upi", "upi", "upi", "cod", "cod", "netbanking"];
const round = (n) => Math.round(n * 100) / 100;

export function buildHistory(now = new Date(), days = 42) {
  const rnd = prng(20260916);
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const sellable = PRODUCTS.filter((p) => p.status === "active" && !p.flags?.prescriptionRequired);
  const bySeller = {};
  sellable.forEach((p) => { (bySeller[sellerForProduct(p)] ||= []).push(p); });
  const totalWeight = SELLER_WEIGHTS.reduce((s, [, w]) => s + w, 0);
  const pickSeller = () => { let r = rnd() * totalWeight; for (const [id, w] of SELLER_WEIGHTS) { if ((r -= w) <= 0) return id; } return SELLER_WEIGHTS[0][0]; };

  const line = (p) => {
    const variant = p.variants?.length ? pick(p.variants) : null;
    const { price } = priceOf(p, variant?.id || null);
    const cheap = price < 5;
    return { productId: p.id, variantId: variant?.id || null, qty: 1 + Math.floor(rnd() * (cheap ? 4 : 2)), unitPrice: price, tax: p.tax || 0 };
  };

  const orders = [];
  let n = 0;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

  const create = (sellerId, placed) => {
      const pool = bySeller[sellerId];
      if (!pool?.length) return;
      const lines = [];
      const want = 1 + Math.floor(rnd() * 3);
      while (lines.length < want) {
        const p = pick(pool);
        if (!lines.some((l) => l.productId === p.id)) lines.push(line(p));
        if (pool.length <= lines.length) break;
      }
      if (rnd() < 0.15) { // an occasional basket that spans two sellers
        const other = pick(sellable);
        if (!lines.some((l) => l.productId === other.id)) lines.push(line(other));
      }

      const ageH = (now - placed) / 36e5;

      let status;
      const r = rnd();
      if (ageH > 48) status = r < 0.9 ? "delivered" : r < 0.95 ? "cancelled" : "returned";
      else if (ageH > 24) status = r < 0.85 ? "delivered" : r < 0.9 ? "cancelled" : "out_for_delivery";
      else if (ageH < 1) status = r < 0.6 ? "placed" : "confirmed";
      else if (ageH < 3) status = r < 0.5 ? "confirmed" : "preparing";
      else if (ageH < 6) status = r < 0.5 ? "preparing" : "packed";
      else if (ageH < 12) status = r < 0.3 ? "packed" : r < 0.6 ? "out_for_delivery" : "delivered";
      else status = r < 0.25 ? "out_for_delivery" : "delivered";

      const at = (mins) => new Date(placed.getTime() + mins * 60000).toISOString();
      const flow = [["placed", 0], ["confirmed", 4], ["preparing", 25], ["packed", 60], ["out_for_delivery", 120], ["delivered", 190]];
      const reached = status === "cancelled" ? 2 : status === "returned" ? 6 : flow.findIndex(([s]) => s === status) + 1;
      const history = flow.slice(0, Math.min(reached, 6)).map(([s, m]) => ({ status: s, at: at(m) }));
      if (status === "cancelled") history.push({ status: "cancelled", at: at(40) });
      if (status === "returned") history.push({ status: "returned", at: at(24 * 60 * 2) });

      const subtotal = round(lines.reduce((s, l) => s + l.unitPrice * l.qty, 0));
      const tax = round(lines.reduce((s, l) => s + l.unitPrice * l.qty * (l.tax / 100), 0));
      const deliveryFee = subtotal >= 25 ? 0 : 2.99;
      const customer = pick(SEED_CUSTOMERS.slice(1));
      const [line1, line2, zip] = pick(STREETS);
      const live = !["delivered", "cancelled", "returned"].includes(status);
      n += 1;
      orders.push({
        id: `ord-h${String(n).padStart(3, "0")}`, number: `PN-${4000 + n}`, placedAt: placed.toISOString(),
        storeId: rnd() < 0.7 ? "store-01" : "store-02", status,
        items: lines.map(({ tax: _t, ...l }) => l),
        customer, shipTo: { name: customer.name, phone: customer.phone, line1, line2, city: "Metro City", zip, instructions: "" },
        paymentMethod: pick(PAYMENTS), deliveryOption: deliveryFee ? "express" : "standard",
        totals: { subtotal, discount: 0, deliveryFee, tax, total: round(subtotal + tax + deliveryFee) },
        otp: live && ["out_for_delivery"].includes(status) ? String(1000 + Math.floor(rnd() * 9000)) : null, otpRequired: true,
        partner: ["out_for_delivery", "delivered", "returned"].includes(status) ? { name: "Daniel R.", phone: "+1 555 0231", vehicle: "Scooter · MC-4418" } : null,
        ...(status === "delivered" || status === "returned" ? { deliveredAt: at(190) } : {}),
        history,
      });
  };

  for (let d = days; d >= 0; d--) {
    const day = new Date(startOfToday.getTime() - d * 864e5);
    const weekend = [0, 6].includes(day.getDay());
    const count = (weekend ? 5 : 3) + Math.floor(rnd() * 3) + (d < 14 ? 1 : 0);
    for (let k = 0; k < count; k++) {
      const sellerId = pickSeller();
      const placed = new Date(day); placed.setHours(7 + Math.floor(rnd() * 15), Math.floor(rnd() * 60), 0, 0);
      if (placed > now) continue;
      create(sellerId, placed);
    }
  }

  /* Every shop always has a few orders from the last several hours, so the
     dashboard's "today" and pipeline views are populated whenever it's opened. */
  SELLER_WEIGHTS.forEach(([sellerId]) => {
    for (let i = 0; i < 4; i++) create(sellerId, new Date(now.getTime() - (8 + rnd() * 330) * 60000));
  });

  return orders.sort((a, b) => new Date(b.placedAt) - new Date(a.placedAt));
}

export const SEED_HISTORY_ORDERS = buildHistory();
