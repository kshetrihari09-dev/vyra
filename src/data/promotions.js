/* Reusable promotion engine — rules are data, evaluated in utils/pricing.js. */
export const COUPONS = [
  { code: "NOVA10", type: "percent", value: 10, maxDiscount: 15, minOrder: 20, label: "10% off orders over $20", scope: { type: "all" } },
  { code: "FRESH25", type: "percent", value: 25, maxDiscount: 20, minOrder: 30, label: "25% off Grocery", scope: { type: "category", id: "grocery" } },
  { code: "FLAT5", type: "fixed", value: 5, minOrder: 25, label: "$5 off orders over $25", scope: { type: "all" } },
  { code: "FIRST15", type: "percent", value: 15, maxDiscount: 25, minOrder: 0, firstOrderOnly: true, label: "15% off your first order", scope: { type: "all" } },
  { code: "NOVATECH", type: "percent", value: 12, maxDiscount: 40, minOrder: 50, label: "12% off NovaTech", scope: { type: "brand", id: "novatech" } },
];

export const PROMOTIONS = [
  { id: "flash", name: "Flash Deals", kind: "flash", label: "Up to 35% off", endsAt: "2026-09-16T23:59:00", tag: "flash" },
  { id: "bxgy-snacks", name: "Buy 2 Get 1 — Snacks", kind: "bxgy", buy: 2, get: 1, scope: { type: "category", id: "grocery-snacks" } },
  { id: "first-order", name: "First order discount", kind: "coupon", code: "FIRST15" },
];
export const couponByCode = (code) => COUPONS.find((c) => c.code.toLowerCase() === String(code || "").trim().toLowerCase()) || null;
