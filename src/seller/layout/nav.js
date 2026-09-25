/* The seller's navigation is its own structure — it shares nothing with the
   customer tab bar. `match` lists every view that should highlight the item. */
export const NAV = [
  { view: "shopDashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { view: "shopProducts", label: "Products", icon: "Package" },
  { view: "shopInventory", label: "Inventory", icon: "Warehouse" },
  { view: "shopOrders", label: "Orders", icon: "Receipt", match: ["shopOrderDetails"], badge: true },
  { view: "shopCustomers", label: "Customers", icon: "Users" },
  { view: "shopSales", label: "Sales", icon: "TrendingUp" },
  { view: "shopOffers", label: "Offers", icon: "Megaphone" },
  { view: "shopPayouts", label: "Payouts", icon: "Wallet" },
  { view: "shopReports", label: "Reports", icon: "LineChart" },
  { view: "shopSettings", label: "Shop settings", icon: "Settings" },
];

/** The four sections a shop owner reaches for on a phone; everything else lives in the drawer. */
export const BOTTOM_NAV = ["shopDashboard", "shopOrders", "shopProducts", "shopInventory"];

export const isActive = (item, view) => item.view === view || item.match?.includes(view);
