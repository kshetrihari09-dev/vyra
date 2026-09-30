import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, Divider, Sheet, ConfirmDialog } from "../../components/shared/ui.jsx";
import { Icon, ChevronRight, Palette, Check, ShieldCheck, LogOut } from "../../components/shared/Icon.jsx";
import { THEMES, THEME_ORDER } from "../../theme.js";
import { ROLES } from "../../data/stores.js";
import { isAdmin } from "../../services/access.js";

const MENU = [
  { id: "orders", label: "Your Orders", sub: "Track, reorder and invoices", icon: "Package" },
  { id: "wishlist", label: "Wishlist & Saved", sub: "Price drops and back-in-stock alerts", icon: "Heart" },
  { id: "addresses", label: "Addresses", sub: "Delivery locations", icon: "MapPin" },
  { id: "payment", label: "Payment Methods", sub: "Cards and wallets", icon: "CreditCard" },
  { id: "prescription", label: "Saved Prescriptions", sub: "Uploads and pharmacist decisions", icon: "FileText" },
  { id: "notifications", label: "Notifications", sub: "Orders, offers and alerts", icon: "Bell" },
  { id: "offers", label: "Coupons & Offers", sub: "Codes you can use today", icon: "Tag" },
  { id: "support", label: "Help & Support", sub: "Orders, payments, returns", icon: "LifeBuoy" },
];

const STAFF = [
  { id: "admin", label: "Admin Dashboard", sub: "Catalogue, inventory, orders, reports", icon: "BarChart3" },
  { id: "pos", label: "Point of Sale", sub: "In-store checkout with barcode scanning", icon: "ScanLine" },
  { id: "pharmacy", label: "Pharmacist Console", sub: "Verify prescriptions", icon: "Stethoscope" },
  { id: "delivery", label: "Delivery App", sub: "Assigned runs and OTP handover", icon: "Bike" },
  { id: "shopDashboard", label: "Shop Dashboard", sub: "Products, inventory, orders and payouts", icon: "Store" },
];

export default function Profile({ nav }) {
  const { session, myOrders: orders, wishlist, themeKey, dispatch, auth, toast, notifications } = useApp();
  const C = useC();
  const [themeOpen, setThemeOpen] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const user = session.user;

  return (
    <Page>
      <PageHeader title="Account" />

      <div className="px-4 md:px-0 space-y-4">
        <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <span className="w-14 h-14 rounded-2xl flex items-center justify-center font-extrabold text-lg shrink-0" style={{ background: C.mint, color: C.primary }}>
            {user.name.split(" ").map((n) => n[0]).join("")}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-base truncate" style={{ color: C.navy }}>{user.name}</p>
            <p className="text-xs truncate" style={{ color: C.muted }}>{user.email}</p>
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {user.emailVerified && <Badge tone="ok"><Check size={10} /> Email verified</Badge>}
              {user.phoneVerified && <Badge tone="ok"><Check size={10} /> Phone verified</Badge>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            { label: "Orders", value: orders.length, view: "orders" },
            { label: "Wishlist", value: wishlist.length, view: "wishlist" },
            { label: "Unread", value: notifications.filter((n) => n.unread).length, view: "notifications" },
          ].map((s) => (
            <button key={s.label} onClick={() => nav(s.view)} className="rounded-2xl p-3 text-center" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              <p className="font-extrabold text-lg" style={{ color: C.navy }}>{s.value}</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{s.label}</p>
            </button>
          ))}
        </div>

        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          {MENU.map((m, i) => (
            <button key={m.id} onClick={() => nav(m.id)} className="w-full flex items-center gap-3 p-4 text-left" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Icon name={m.icon} size={17} style={{ color: C.primary }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm" style={{ color: C.navy }}>{m.label}</span>
                <span className="block text-xs truncate" style={{ color: C.muted }}>{m.sub}</span>
              </span>
              <ChevronRight size={17} style={{ color: C.muted }} />
            </button>
          ))}
        </div>

        {/* Appearance — preserved from the original theme switcher */}
        <button onClick={() => setThemeOpen(true)} className="w-full rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
            <Palette size={17} style={{ color: C.primary }} />
          </span>
          <span className="flex-1 text-left">
            <span className="block font-bold text-sm" style={{ color: C.navy }}>Appearance</span>
            <span className="block text-xs" style={{ color: C.muted }}>Theme · {THEMES[themeKey].label}</span>
          </span>
          <span className="flex gap-1.5">
            {THEME_ORDER.map((k) => <span key={k} className="w-4 h-4 rounded-full" style={{ background: THEMES[k].primary, outline: k === themeKey ? `2px solid ${C.navy}` : "none", outlineOffset: 1 }} />)}
          </span>
        </button>

        {/* Staff consoles — role-gated surfaces. Only visible to accounts with
            staff access; a customer who registered themselves never sees this. */}
        {session.isStaff && (
          <div>
            <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: C.muted }}>Staff access</p>
            <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
              {STAFF.filter((m) => m.id !== "admin" || isAdmin(session)).map((m, i) => (
                <button key={m.id} onClick={() => nav(m.id)} className="w-full flex items-center gap-3 p-4 text-left" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.navy }}>
                    <Icon name={m.icon} size={17} color="#fff" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm" style={{ color: C.navy }}>{m.label}</span>
                    <span className="block text-xs truncate" style={{ color: C.muted }}>{m.sub}</span>
                  </span>
                  <ChevronRight size={17} style={{ color: C.muted }} />
                </button>
              ))}
            </div>
            <p className="text-[11px] mt-2 px-1 flex items-center gap-1.5" style={{ color: C.muted }}>
              <ShieldCheck size={12} /> {ROLES.length} roles configured · every action is written to the audit log
            </p>
          </div>
        )}

        {/* Shop registration entry — routes to the application, the status
            page, or straight into the shop dashboard depending on where the
            owner's application currently stands. */}
        <MyShop nav={nav} />

        <PillButton variant="danger" full onClick={() => setSignOut(true)}><LogOut size={15} /> Sign out</PillButton>
      </div>

      <Sheet open={themeOpen} onClose={() => setThemeOpen(false)} title="Appearance">
        <div className="grid grid-cols-2 gap-3">
          {THEME_ORDER.map((k) => {
            const t = THEMES[k];
            const active = k === themeKey;
            return (
              <button key={k} onClick={() => { dispatch({ type: "THEME", key: k }); toast(`${t.label} theme applied`); }}
                className="rounded-2xl p-4 text-left" style={{ background: t.bg, border: `1.5px solid ${active ? t.primary : C.border}` }}>
                <span className="flex gap-1.5 mb-2">
                  <span className="w-6 h-6 rounded-full" style={{ background: t.primary }} />
                  <span className="w-6 h-6 rounded-full" style={{ background: t.navy }} />
                  <span className="w-6 h-6 rounded-full" style={{ background: t.mint }} />
                </span>
                <span className="flex items-center gap-1.5 font-bold text-sm" style={{ color: t.navy }}>
                  {t.label} {active && <Check size={14} style={{ color: t.primary }} />}
                </span>
              </button>
            );
          })}
        </div>
      </Sheet>

      <ConfirmDialog open={signOut} onClose={() => setSignOut(false)} title="Sign out?"
        message="Your cart and wishlist are kept for when you come back."
        confirmLabel="Sign out" onConfirm={async () => { await auth.logout(); nav("welcome"); }} />
    </Page>
  );
}

function MyShop({ nav }) {
  const { shopApplications, session } = useApp();
  const C = useC();
  const app = shopApplications.find((a) => a.owner.mobile === session.user.phone);

  if (!app) {
    return (
      <button onClick={() => nav("shopOnboarding")} className="w-full rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1.5px dashed ${C.primary}` }}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
          <Icon name="Store" size={17} style={{ color: C.primary }} />
        </span>
        <span className="flex-1 text-left">
          <span className="block font-bold text-sm" style={{ color: C.navy }}>Register Your Shop</span>
          <span className="block text-xs" style={{ color: C.muted }}>Start selling on Vyra</span>
        </span>
        <ChevronRight size={17} style={{ color: C.muted }} />
      </button>
    );
  }

  const label = app.status === "approved" ? "Shop Dashboard" : app.status === "draft" ? "Continue Shop Application" : "Shop Application";
  const sub = { draft: "Pick up where you left off", submitted: "Under review", under_review: "Under review", approved: app.shop.name, rejected: "Changes needed — tap to view", suspended: "Suspended" }[app.status];
  const dest = app.status === "approved" ? "shopDashboard" : "shopStatus";
  const destParams = app.status === "approved" ? {} : { applicationId: app.id };

  return (
    <button onClick={() => nav(dest, destParams)} className="w-full rounded-2xl p-4 flex items-center gap-3" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
        <Icon name="Store" size={17} style={{ color: C.primary }} />
      </span>
      <span className="flex-1 text-left min-w-0">
        <span className="block font-bold text-sm" style={{ color: C.navy }}>{label}</span>
        <span className="block text-xs truncate" style={{ color: C.muted }}>{sub}</span>
      </span>
      {app.status !== "approved" && <Badge tone={app.status === "rejected" ? "danger" : "warn"}>{app.status.replace("_", " ")}</Badge>}
      <ChevronRight size={17} style={{ color: C.muted }} />
    </button>
  );
}
