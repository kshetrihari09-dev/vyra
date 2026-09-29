import React, { useMemo, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, Badge, Divider, PillButton } from "../components/shared/ui.jsx";
import { Icon, TrendingUp, AlertTriangle, Clock } from "../components/shared/Icon.jsx";
import AdminProducts from "./Products.jsx";
import AdminCategories from "./Categories.jsx";
import AdminInventory from "./Inventory.jsx";
import AdminOrders from "./Orders.jsx";
import AdminCustomers from "./Customers.jsx";
import AdminReports from "./Reports.jsx";
import AdminSellers from "./Sellers.jsx";
import AdminPurchases from "./Purchases.jsx";
import AdminShopApplications from "./ShopApplications.jsx";
import AuditLogPage from "./AuditLog.jsx";
import { storeById, STORES, ROLES } from "../data/stores.js";
import { expiringSoon } from "../utils/inventory.js";
import { fmt, timeAgo } from "../utils/format.js";
import { TONE } from "../theme.js";

const SECTIONS = [
  { id: "overview", label: "Dashboard", icon: "BarChart3" },
  { id: "orders", label: "Orders", icon: "Package" },
  { id: "products", label: "Products", icon: "Boxes" },
  { id: "categories", label: "Categories", icon: "LayoutGrid" },
  { id: "sellers", label: "Sellers", icon: "Store" },
  { id: "shopApplications", label: "Shop Applications", icon: "ShieldCheck" },
  { id: "purchases", label: "Purchases", icon: "Truck" },
  { id: "inventory", label: "Inventory", icon: "ClipboardList" },
  { id: "customers", label: "Customers", icon: "Users" },
  { id: "reports", label: "Reports", icon: "TrendingUp" },
  { id: "auditLog", label: "Audit Log", icon: "History" },
];

/** Admin shell. Every section reads and writes the same state the storefront
    uses, so a change here is visible to customers immediately. */
export default function Admin({ nav, params }) {
  const C = useC();
  const [section, setSection] = useState(params.section || "overview");

  return (
    <Page wide>
      <PageHeader title="Admin Console" subtitle="Catalogue, inventory, orders and reports" onBack={() => nav("profile")} />
      <div className="px-4 md:px-0">
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5">
          {SECTIONS.map((s) => (
            <button key={s.id} onClick={() => setSection(s.id)}
              className="shrink-0 px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5"
              style={{ background: section === s.id ? C.navy : C.white, color: section === s.id ? "#fff" : C.navy, border: `1px solid ${section === s.id ? C.navy : C.border}` }}>
              <Icon name={s.icon} size={14} /> {s.label}
            </button>
          ))}
        </div>

        {section === "overview" && <Overview nav={nav} setSection={setSection} />}
        {section === "orders" && <AdminOrders nav={nav} />}
        {section === "products" && <AdminProducts nav={nav} />}
        {section === "categories" && <AdminCategories />}
        {section === "sellers" && <AdminSellers />}
        {section === "shopApplications" && <AdminShopApplications />}
        {section === "purchases" && <AdminPurchases />}
        {section === "inventory" && <AdminInventory />}
        {section === "customers" && <AdminCustomers />}
        {section === "reports" && <AdminReports />}
        {section === "auditLog" && <AuditLogPage />}
      </div>
    </Page>
  );
}

function Overview({ nav, setSection }) {
  const { orders, products, categories, storeId, auditLog, prescriptions, sellers, shopApplications } = useApp();
  const C = useC();

  const stats = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const isToday = (iso) => (iso || "").slice(0, 10) === todayKey;
    const revenue = orders.filter((o) => !["cancelled", "returned"].includes(o.status)).reduce((s, o) => s + o.totals.total, 0);
    const todaysOrders = orders.filter((o) => isToday(o.placedAt));
    const todaysSales = todaysOrders.filter((o) => !["cancelled", "returned"].includes(o.status)).reduce((s, o) => s + o.totals.total, 0);
    const open = orders.filter((o) => !["delivered", "cancelled", "returned"].includes(o.status)).length;
    const outOfStock = products.filter((p) => {
      const q = p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock?.[storeId] || 0), 0) : (p.stock?.[storeId] || 0);
      return q <= 0;
    }).length;
    const lowStock = products.filter((p) => {
      const q = p.variants?.length ? p.variants.reduce((s, v) => s + (v.stock?.[storeId] || 0), 0) : (p.stock?.[storeId] || 0);
      return q > 0 && q <= 10;
    }).length;
    const expiring = products.filter((p) => expiringSoon(p, 90).length > 0).length;
    const pendingListings = products.filter((p) => p.status === "pending_review").length;
    const pendingSellers = sellers.filter((s) => s.status === "pending").length;
    const pendingDeliveries = orders.filter((o) => ["assigned", "out_for_delivery"].includes(o.status)).length;
    const pendingPayments = orders.filter((o) => o.paymentMethod === "cod" && !["delivered"].includes(o.status)).length;
    const pendingShopApps = shopApplications.filter((a) => ["submitted", "under_review"].includes(a.status)).length;
    return { revenue, todaysSales, todaysOrders: todaysOrders.length, open, outOfStock, lowStock, expiring, pendingListings, pendingSellers, pendingDeliveries, pendingPayments, pendingShopApps };
  }, [orders, products, storeId, sellers, shopApplications]);

  const cards = [
    { label: "Today's sales", value: fmt(stats.todaysSales), sub: `${stats.todaysOrders} orders today`, icon: "TrendingUp", tone: C.primary },
    { label: "Open orders", value: stats.open, sub: "Need fulfilment", icon: "Package", tone: TONE.info, go: "orders" },
    { label: "Pending prescriptions", value: prescriptions.filter((r) => r.status === "pending").length, sub: "Awaiting review", icon: "FileText", tone: TONE.ok, go: "pharmacy" },
    { label: "Low stock", value: stats.lowStock, sub: "At or below threshold", icon: "AlertTriangle", tone: TONE.warn, go: "inventory" },
    { label: "Expiring soon", value: stats.expiring, sub: "Within 90 days", icon: "Clock", tone: TONE.danger, go: "inventory" },
    { label: "Out of stock", value: stats.outOfStock, sub: "Zero units on hand", icon: "Boxes", tone: TONE.danger, go: "inventory" },
    { label: "Pending deliveries", value: stats.pendingDeliveries, sub: "Assigned or en route", icon: "Truck", tone: TONE.info, go: "orders" },
    { label: "Pending payments", value: stats.pendingPayments, sub: "Cash on delivery, unpaid", icon: "Banknote", tone: TONE.warn, go: "orders" },
    { label: "Seller listings", value: stats.pendingListings, sub: "Awaiting approval", icon: "Boxes", tone: TONE.warn, go: "sellers" },
    { label: "Seller applications", value: stats.pendingSellers, sub: `${sellers.length} total sellers`, icon: "Store", tone: C.navy, go: "sellers" },
    { label: "Shop applications", value: stats.pendingShopApps, sub: "Awaiting verification", icon: "ShieldCheck", tone: TONE.warn, go: "shopApplications" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <PillButton size="sm" onClick={() => nav("pos")}>Open POS</PillButton>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <button key={c.label} onClick={() => c.go && (c.go === "pharmacy" ? nav("pharmacy") : setSection(c.go))}
            className="rounded-2xl p-4 text-left" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <span className="w-9 h-9 rounded-xl flex items-center justify-center mb-2.5" style={{ background: c.tone + "18" }}>
              <Icon name={c.icon} size={16} style={{ color: c.tone }} />
            </span>
            <p className="font-extrabold text-xl" style={{ color: C.navy }}>{c.value}</p>
            <p className="text-xs font-semibold" style={{ color: C.navy }}>{c.label}</p>
            <p className="text-[11px]" style={{ color: C.muted }}>{c.sub}</p>
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Stores</p>
          {STORES.map((s, i) => (
            <div key={s.id} className="flex items-center gap-3 py-2" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Icon name="Store" size={15} style={{ color: C.primary }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: C.navy }}>{s.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{s.hours} · {s.etaMinutes} min ETA</p>
              </div>
              <Badge tone={s.id === storeId ? "mint" : "neutral"}>{s.id === storeId ? "Active" : s.code}</Badge>
            </div>
          ))}
        </div>

        <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="font-extrabold text-sm mb-1" style={{ color: C.navy }}>Audit log</p>
          <p className="text-[11px] mb-3" style={{ color: C.muted }}>{ROLES.length} roles · every catalogue, stock and order change is recorded</p>
          <div className="space-y-2.5 max-h-56 overflow-y-auto">
            {auditLog.map((a) => (
              <div key={a.id} className="flex gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: C.primary }} />
                <div className="min-w-0">
                  <p className="text-xs font-bold" style={{ color: C.navy }}>{a.action}</p>
                  <p className="text-[11px]" style={{ color: C.muted }}>{a.detail} · {a.actor} · {timeAgo(a.at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
