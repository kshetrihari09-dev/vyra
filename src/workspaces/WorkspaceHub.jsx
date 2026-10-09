import React, { useMemo } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { Icon } from "../components/shared/Icon.jsx";
import { ChevronRight } from "../components/shared/Icon.jsx";
import { Logo } from "../components/shared/Logo.jsx";
import { hasPermission } from "../services/access.js";
import { WORKSPACES, validLast, workspaceOfView, SHOP, ADMIN, DELIVERY, POS, PHARMACY, CUSTOMER } from "../services/workspaces.js";
import { createLastStore } from "../services/lastWorkspace.js";
import { useWorkspaces } from "./useWorkspaces.js";

const greeting = (d = new Date()) => { const h = d.getHours(); return h < 5 ? "Hello" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"; };

/** Short, honest names for the screens we remember (only views in the remember-allowlist appear here). */
const VIEW_LABEL = {
  home: "Home", shopDashboard: "Dashboard", shopProducts: "Products", shopInventory: "Inventory", shopOrders: "Orders", shopCustomers: "Customers",
  shopSales: "Sales", shopOffers: "Offers", shopPayouts: "Payouts", shopReports: "Reports", shopSettings: "Settings",
  pos: "Point of Sale", pharmacy: "Prescriptions", admin: "Admin console", delivery: "Delivery app", deliveryRun: "Active delivery",
};

/** Quick actions per workspace. Only the workspace's own, real screens; each is shown only when this account may use it. */
function quickActions(id, session) {
  switch (id) {
    case SHOP: return [
      hasPermission(session, "pos:sell") ? { label: "New sale", icon: "ScanLine", to: ["pos"], primary: true } : { label: "Sales", icon: "TrendingUp", to: ["shopSales"], primary: true },
      { label: "Products", icon: "Package", to: ["shopProducts"] }, { label: "Orders", icon: "Receipt", to: ["shopOrders"] },
      { label: "Inventory", icon: "Warehouse", to: ["shopInventory"] }, { label: "Customers", icon: "Users", to: ["shopCustomers"] }, { label: "Reports", icon: "LineChart", to: ["shopReports"] },
    ];
    case ADMIN: return [
      { label: "Orders", icon: "Package", to: ["admin", { section: "orders" }], primary: true }, { label: "Products", icon: "Boxes", to: ["admin", { section: "products" }] },
      { label: "Sellers", icon: "Store", to: ["admin", { section: "sellers" }] }, { label: "Shop applications", icon: "ShieldCheck", to: ["admin", { section: "shopApplications" }] },
      { label: "Reports", icon: "TrendingUp", to: ["admin", { section: "reports" }] },
    ];
    case DELIVERY: return [
      { label: "My runs", icon: "Bike", to: ["delivery", { resume: "active" }], primary: true }, { label: "Available", icon: "Package", to: ["delivery", { tab: "available" }] }, { label: "History", icon: "History", to: ["delivery", { tab: "history" }] },
    ];
    case POS: return [{ label: "New sale", icon: "ScanLine", to: ["pos"], primary: true }];
    case PHARMACY: return [{ label: "Prescriptions", icon: "Stethoscope", to: ["pharmacy"], primary: true }];
    default: return [{ label: "Shop", icon: "ShoppingCart", to: ["home"], primary: true }, { label: "My orders", icon: "Package", to: ["orders"] }, { label: "Wishlist", icon: "Heart", to: ["wishlist"] }];
  }
}

/**
 * The signed-in entry point for people with more than one workspace: pick where to work, or continue where you left off.
 * People with a single obvious workspace never land here (services/workspaces.js sends them straight to it), but they can open it.
 * Every card and shortcut only appears for a workspace the account is authorised for; each screen still runs its own gate and the API re-checks.
 */
export default function WorkspaceHub({ nav }) {
  const C = useC();
  const { session } = useApp();
  const ws = useWorkspaces(nav, "workspaces");
  const userId = session.user.uuid;
  const cont = useMemo(() => validLast(createLastStore().read(userId), ws.ids, userId), [userId, ws.ids]);
  const first = (session.user.name || "").split(" ")[0];

  return (
    <Page>
      <div className="px-4 md:px-0 max-w-3xl mx-auto">
        <div className="mb-6"><Logo withTagline={false} /></div>
        <h1 className="font-extrabold text-2xl" style={{ color: C.navy }}>{greeting()}{first ? `, ${first}` : ""} 👋</h1>
        <p className="text-sm mt-1" style={{ color: C.muted }}>{ws.multiple ? "Choose where you want to work." : "Here's everything you can open."}</p>

        {cont && (
          <button type="button" onClick={() => nav(cont.view, cont.params)} className="w-full mt-5 flex items-center gap-3 p-4 rounded-2xl text-left" style={{ background: C.primary, color: "#fff" }}>
            <Icon name={WORKSPACES[cont.workspace].icon} size={20} color="#fff" />
            <span className="flex-1 min-w-0">
              <span className="block text-[11px] font-bold uppercase tracking-wide opacity-80">Continue where you left off</span>
              <span className="block font-bold">{WORKSPACES[cont.workspace].label} · {VIEW_LABEL[cont.view] || WORKSPACES[cont.workspace].label}</span>
            </span>
            <ChevronRight size={18} color="#fff" />
          </button>
        )}

        <div className="grid md:grid-cols-2 gap-4 mt-5">
          {ws.items.map((w) => (
            <section key={w.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }} aria-label={w.label}>
              <button type="button" onClick={() => ws.go(w.id)} className="w-full flex items-center gap-3 text-left">
                <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.navy }}><Icon name={w.icon} size={18} color="#fff" /></span>
                <span className="flex-1 min-w-0">
                  <span className="block font-extrabold" style={{ color: C.navy }}>{w.label}</span>
                  <span className="block text-xs truncate" style={{ color: C.muted }}>{w.sub}</span>
                </span>
                <ChevronRight size={17} style={{ color: C.muted }} />
              </button>
              <div className="flex flex-wrap gap-2 mt-3">
                {quickActions(w.id, session).map((a) => (
                  <button key={a.label} type="button" onClick={() => nav(a.to[0], a.to[1] || {})}
                    className="inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-bold"
                    style={a.primary ? { background: C.primary, color: "#fff" } : { background: C.mint, color: C.primary }}>
                    <Icon name={a.icon} size={13} /> {a.label}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </Page>
  );
}
