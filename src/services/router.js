/* Tiny URL router. The app already navigates with nav(view, params); this
   maps each view to a real URL so /customer/* and /shop/* are distinct,
   shareable and survive the back button — without adding a router dependency.

   A view belongs to exactly one "area", and the area decides which shell
   (layout + navigation) renders it. Nothing else in the app needs to know
   about URLs. */

const R = (view, path, area) => ({ view, path, area, segs: path.split("/").filter(Boolean) });

export const ROUTES = [
  R("welcome", "/welcome", "bare"),

  /* Customer storefront */
  R("home", "/customer/home", "customer"),
  R("categories", "/customer/categories", "customer"),
  R("category", "/customer/categories/:categoryId", "customer"),
  R("product", "/customer/products/:productId", "customer"),
  R("search", "/customer/search", "customer"),
  R("cart", "/customer/cart", "customer"),
  R("checkout", "/customer/checkout", "customer"),
  R("orderConfirmed", "/customer/orders/:orderId/confirmed", "customer"),
  R("orders", "/customer/orders", "customer"),
  R("orderDetails", "/customer/orders/:orderId", "customer"),
  R("wishlist", "/customer/wishlist", "customer"),
  R("profile", "/customer/profile", "customer"),
  R("addresses", "/customer/addresses", "customer"),
  R("payment", "/customer/payment-methods", "customer"),
  R("notifications", "/customer/notifications", "customer"),
  R("prescription", "/customer/prescriptions", "customer"),
  R("support", "/customer/support", "customer"),
  R("offers", "/customer/offers", "customer"),

  /* Shop / seller business dashboard */
  R("shopDashboard", "/shop/dashboard", "shop"),
  R("shopProducts", "/shop/products", "shop"),
  R("shopInventory", "/shop/inventory", "shop"),
  R("shopOrderDetails", "/shop/orders/:orderId", "shop"),
  R("shopOrders", "/shop/orders", "shop"),
  R("shopCustomers", "/shop/customers", "shop"),
  R("shopSales", "/shop/sales", "shop"),
  R("shopOffers", "/shop/offers", "shop"),
  R("shopPayouts", "/shop/payouts", "shop"),
  R("shopReports", "/shop/reports", "shop"),
  R("shopSettings", "/shop/settings", "shop"),

  /* Shop registration happens before a shop exists, so it is not part of the dashboard shell. */
  R("shopOnboarding", "/shop/apply", "apply"),
  R("shopStatus", "/shop/application", "apply"),

  /* Staff consoles keep their existing chrome. */
  R("admin", "/admin", "staff"),
  R("pharmacy", "/pharmacy", "staff"),
  R("delivery", "/delivery", "staff"),
  R("pos", "/pos", "bare"),
];

const byView = Object.fromEntries(ROUTES.map((r) => [r.view, r]));
export const areaOf = (view) => byView[view]?.area || "customer";
export const isShopView = (view) => areaOf(view) === "shop";

/** Legacy view names from before the split still resolve. */
const ALIASES = { seller: "shopDashboard" };

export function toPath(view, params = {}) {
  const route = byView[ALIASES[view] || view] || byView.home;
  const used = new Set();
  const path = "/" + route.segs.map((s) => {
    if (!s.startsWith(":")) return s;
    const key = s.slice(1);
    used.add(key);
    return encodeURIComponent(params[key] ?? "");
  }).join("/");
  const rest = Object.entries(params).filter(([k, v]) => !used.has(k) && v != null && typeof v !== "object" && v !== false);
  const qs = rest.length ? "?" + rest.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
  return path + qs;
}

export function fromLocation(pathname, search = "") {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return null;
  if (parts[0] === "seller") return { view: "shopDashboard", params: {} };
  for (const r of ROUTES) {
    if (r.segs.length !== parts.length) continue;
    const params = {};
    const ok = r.segs.every((s, i) => {
      if (s.startsWith(":")) { params[s.slice(1)] = decodeURIComponent(parts[i]); return true; }
      return s === parts[i];
    });
    if (!ok) continue;
    new URLSearchParams(search).forEach((v, k) => { params[k] = v; });
    return { view: r.view, params };
  }
  return { view: "home", params: {} };
}
