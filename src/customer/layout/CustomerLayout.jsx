import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { SearchBar } from "../components/SearchBar.jsx";
import { Sheet, PillButton, IconCircleButton, Badge } from "../../components/shared/ui.jsx";
import { Logo } from "../../components/shared/Logo.jsx";
import { Page } from "../../components/shared/Page.jsx";
import { roleOf } from "../../services/access.js";
import { Icon, Bell, ChevronDown, Heart, Home, LayoutGrid, MapPin, Search, ShoppingCart, Store, User, Clock, Check, ShieldCheck } from "../../components/shared/Icon.jsx";
import { STORES } from "../../data/stores.js";
import { topCategories } from "../../data/categories.js";

function StoreSelector({ compact }) {
  const { storeId, dispatch, toast } = useApp();
  const C = useC();
  const [open, setOpen] = useState(false);
  const store = STORES.find((s) => s.id === storeId);
  return (
    <>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 min-w-0 text-left">
        <MapPin size={14} style={{ color: C.primary }} className="shrink-0" />
        <span className="min-w-0">
          <span className="block text-[10px] leading-none" style={{ color: C.muted }}>Delivering from</span>
          <span className="flex items-center gap-1">
            <span className="text-xs font-bold truncate" style={{ color: C.navy, maxWidth: compact ? 120 : 200 }}>{store.name}</span>
            <ChevronDown size={12} style={{ color: C.navy }} />
          </span>
        </span>
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Choose a store">
        <p className="text-sm mb-4" style={{ color: C.muted }}>Stock, prices and delivery times are specific to each store.</p>
        <div className="space-y-3">
          {STORES.map((s) => (
            <button key={s.id} onClick={() => { dispatch({ type: "STORE", id: s.id }); setOpen(false); toast(`Now shopping at ${s.name}`); }}
              className="w-full text-left rounded-2xl p-4 flex gap-3"
              style={{ background: C.white, border: `1.5px solid ${s.id === storeId ? C.primary : C.border}` }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Store size={17} style={{ color: C.primary }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: C.navy }}>{s.name}</span>
                  {s.id === storeId && <Check size={14} style={{ color: C.primary }} />}
                </span>
                <span className="block text-xs mt-0.5" style={{ color: C.muted }}>{s.address}</span>
                <span className="flex items-center gap-3 mt-1.5 text-[11px]" style={{ color: C.muted }}>
                  <span className="flex items-center gap-1"><Clock size={11} /> {s.etaMinutes} min</span>
                  <span>{s.distanceKm} km away</span>
                  {s.pharmacistOnDuty && <Badge tone="ok">Pharmacist on duty</Badge>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}

export function MobileHeader({ nav, query, setQuery }) {
  const { cartCount, session, shopApplications, unread } = useApp();
  const C = useC();
  const role = roleOf(session, shopApplications);
  return (
    <header className="md:hidden sticky top-0 z-30 px-4 pt-3 pb-3" style={{ background: C.bg, borderBottom: `1px solid ${C.border}` }}>
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 min-w-0"><StoreSelector compact /></div>
        {role === "staff" && <IconCircleButton icon={ShieldCheck} ariaLabel="Admin console" size={36} onClick={() => nav("admin")} />}
        {role === "shop_owner" && <IconCircleButton icon={Store} ariaLabel="Shop dashboard" size={36} onClick={() => nav("shopDashboard")} />}
        <IconCircleButton icon={Bell} ariaLabel="Notifications" badge={unread} size={36} onClick={() => nav("notifications")} />
        <IconCircleButton icon={ShoppingCart} ariaLabel="Cart" badge={cartCount} size={36} onClick={() => nav("cart")} />
        <IconCircleButton icon={User} ariaLabel="Profile" size={36} onClick={() => nav("profile")} />
      </div>
      <SearchBar value={query} onChange={setQuery} onSubmit={() => nav("search")}
        onPick={(s) => {
          if (s.type === "product") nav("product", { productId: s.id });
          else if (s.type === "category") nav("category", { categoryId: s.id });
          else { setQuery(s.label); nav("search"); }
        }} />
    </header>
  );
}

export function DesktopHeader({ nav, view, query, setQuery }) {
  const { cartCount, wishlist, categories, session, shopApplications, unread } = useApp();
  const C = useC();
  const role = roleOf(session, shopApplications);
  const tops = topCategories(categories).slice(0, 7);

  return (
    <header className="hidden md:block sticky top-0 z-30" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
      <div className="max-w-7xl mx-auto px-8">
        <div className="flex items-center gap-6 py-3">
          <button onClick={() => nav("home")}><Logo withTagline={false} /></button>
          <div className="shrink-0"><StoreSelector /></div>
          <div className="flex-1 max-w-2xl">
            <SearchBar value={query} onChange={setQuery} onSubmit={() => nav("search")}
              onPick={(s) => {
                if (s.type === "product") nav("product", { productId: s.id });
                else if (s.type === "category") nav("category", { categoryId: s.id });
                else { setQuery(s.label); nav("search"); }
              }} />
          </div>
          <nav className="flex items-center gap-2 shrink-0">
            {role === "staff" && <IconCircleButton icon={ShieldCheck} ariaLabel="Admin console" onClick={() => nav("admin")} />}
            {(role === "staff" || role === "shop_owner") && <IconCircleButton icon={Store} ariaLabel="Shop dashboard" onClick={() => nav("shopDashboard")} />}
            <IconCircleButton icon={Heart} ariaLabel="Wishlist" badge={wishlist.length} onClick={() => nav("wishlist")} />
            <IconCircleButton icon={Bell} ariaLabel="Notifications" badge={unread} onClick={() => nav("notifications")} />
            <IconCircleButton icon={ShoppingCart} ariaLabel="Cart" badge={cartCount} onClick={() => nav("cart")} />
            <button onClick={() => nav("profile")} className="flex items-center gap-2 px-3 h-10 rounded-full" style={{ background: C.mint }}>
              <User size={16} style={{ color: C.primary }} />
              <span className="text-sm font-bold" style={{ color: C.primary }}>Account</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-1 pb-2 overflow-x-auto no-scrollbar">
          <button onClick={() => nav("categories")} className="px-3 py-2 rounded-full text-sm font-bold flex items-center gap-1.5 shrink-0"
            style={{ background: view === "categories" ? C.mint : "transparent", color: view === "categories" ? C.primary : C.navy }}>
            <LayoutGrid size={15} /> All Categories
          </button>
          {tops.map((c) => (
            <button key={c.id} onClick={() => nav("category", { categoryId: c.id })}
              className="px-3 py-2 rounded-full text-sm font-semibold shrink-0 whitespace-nowrap hover:opacity-70"
              style={{ color: C.navy }}>{c.name}</button>
          ))}
          <button onClick={() => nav("offers")} className="px-3 py-2 rounded-full text-sm font-bold shrink-0" style={{ color: C.primary }}>Offers</button>
        </div>
      </div>
    </header>
  );
}

const TABS = [
  { id: "home", label: "Home", icon: Home },
  { id: "categories", label: "Categories", icon: LayoutGrid },
  { id: "search", label: "Search", icon: Search },
  { id: "cart", label: "Cart", icon: ShoppingCart },
  { id: "profile", label: "Account", icon: User },
];

export function BottomNav({ view, nav }) {
  const { cartCount } = useApp();
  const C = useC();
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 flex items-stretch px-2 pt-1.5 pb-[max(env(safe-area-inset-bottom),8px)]"
      style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
      {TABS.map((t) => {
        const active = view === t.id;
        const Cmp = t.icon;
        return (
          <button key={t.id} onClick={() => nav(t.id)} className="flex-1 flex flex-col items-center gap-1 py-1.5 relative">
            <span className="relative">
              <Cmp size={20} style={{ color: active ? C.primary : C.muted }} />
              {t.id === "cart" && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center"
                  style={{ background: "#E0546A", color: "#fff" }}>{cartCount}</span>
              )}
            </span>
            <span className="text-[10px] font-bold" style={{ color: active ? C.primary : C.muted }}>{t.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export { Logo, Page };
