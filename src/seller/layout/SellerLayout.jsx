import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useS } from "../components/tokens.js";
import { IconBtn, Btn, Modal, Select } from "../components/kit.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { NAV, BOTTOM_NAV, isActive } from "./nav.js";
import { useShop } from "../hooks/useShopData.js";
import { roleOf } from "../../services/access.js";
import { fmt } from "../../utils/format.js";
import { TONE } from "../../theme.js";

/* Business-dashboard shell: dark sidebar + top bar on desktop, icon rail on
   tablet, top bar + drawer + bottom tabs on phones. It renders no customer
   navigation anywhere. */

function Brand({ compact }) {
  const s = useS();
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <span className="w-8 h-8 inline-flex items-center justify-center shrink-0" style={{ background: s.accent, borderRadius: 8 }}>
        <Icon name="ShoppingBasket" size={17} color="#fff" />
      </span>
      {!compact && (
        <span className="leading-none">
          <span className="s-heading block text-[17px] font-bold text-white tracking-tight">Vyra</span>
          <span className="block text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,.6)" }}>Shop manager</span>
        </span>
      )}
    </div>
  );
}

function NavList({ view, nav, onPick, showLabels = true }) {
  const s = useS();
  const { rows } = useShop();
  const open = rows.filter((r) => ["pending", "confirmed", "preparing", "ready"].includes(r.status.key)).length;
  return (
    <ul className="space-y-0.5">
      {NAV.map((item) => {
        const on = isActive(item, view);
        return (
          <li key={item.view}>
            <button type="button" onClick={() => { nav(item.view); onPick?.(); }} title={item.label} aria-current={on ? "page" : undefined}
              className={`relative w-full h-10 flex items-center gap-3 ${showLabels ? "px-3" : "justify-center"} text-sm font-medium hover:bg-white/5`}
              style={{ borderRadius: 8, background: on ? "rgba(255,255,255,.10)" : "transparent", color: on ? "#fff" : "rgba(255,255,255,.7)" }}>
              {on && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r" style={{ background: s.accent }} />}
              <Icon name={item.icon} size={18} />
              {showLabels && <span className="flex-1 text-left truncate">{item.label}</span>}
              {item.badge && open > 0 && (showLabels
                ? <span className="tnum text-[11px] font-semibold px-1.5 rounded" style={{ background: "rgba(255,255,255,.14)", color: "#fff" }}>{open}</span>
                : <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full" style={{ background: TONE.warn }} />)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function TopSearch({ nav, autoFocus, onDone }) {
  const s = useS();
  const { rows, listings, customers } = useShop();
  const [q, setQ] = useState("");
  const results = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (t.length < 2) return [];
    const orders = rows.filter((r) => r.number.toLowerCase().includes(t) || r.customer.name.toLowerCase().includes(t)).slice(0, 4)
      .map((r) => ({ key: `o-${r.id}`, icon: "Receipt", label: r.number, sub: r.customer.name, go: () => nav("shopOrderDetails", { orderId: r.id }) }));
    const products = listings.filter((p) => p.name.toLowerCase().includes(t) || (p.sku || "").toLowerCase().includes(t)).slice(0, 4)
      .map((p) => ({ key: `p-${p.id}`, icon: "Package", label: p.name, sub: p.sku, go: () => nav("shopProducts", { q: p.name }) }));
    const people = customers.filter((c) => c.name.toLowerCase().includes(t) || (c.phone || "").includes(t)).slice(0, 3)
      .map((c) => ({ key: `c-${c.id}`, icon: "Users", label: c.name, sub: c.phone || "Customer", go: () => nav("shopCustomers", { q: c.name }) }));
    return [...orders, ...products, ...people];
  }, [q, rows, listings, customers]);
  return (
    <div className="relative w-full max-w-md">
      <div className="flex items-center gap-2 h-9 px-3" style={{ background: s.canvas, borderRadius: s.r }}>
        <Icon name="Search" size={15} style={{ color: s.faint }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} autoFocus={autoFocus} placeholder="Search orders, products, customers" aria-label="Search orders, products, customers"
          className="flex-1 min-w-0 text-sm bg-transparent outline-none" />
      </div>
      {q.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden" style={{ background: "#fff", border: `1px solid ${s.line}`, borderRadius: s.rPanel, boxShadow: "0 12px 30px rgba(16,32,42,.14)" }}>
          {results.length === 0 ? <p className="px-3 py-3 text-sm" style={{ color: s.muted }}>No matches in your shop.</p> : results.map((r) => (
            <button key={r.key} type="button" onClick={() => { r.go(); setQ(""); onDone?.(); }} className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-black/[.03]">
              <Icon name={r.icon} size={15} style={{ color: s.faint }} />
              <span className="min-w-0"><span className="block text-sm font-medium truncate" style={{ color: s.text }}>{r.label}</span><span className="block text-xs truncate" style={{ color: s.muted }}>{r.sub}</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* Alerts are derived from live shop data, not stored. */
function Alerts({ nav }) {
  const s = useS();
  const { rows, inventoryTotals, available } = useShop();
  const [open, setOpen] = useState(false);
  const items = [
    rows.filter((r) => r.status.key === "pending").length && { icon: "Receipt", text: `${rows.filter((r) => r.status.key === "pending").length} new order(s) waiting for confirmation`, view: "shopOrders" },
    inventoryTotals.out > 0 && { icon: "AlertTriangle", text: `${inventoryTotals.out} item(s) out of stock`, view: "shopInventory" },
    inventoryTotals.low > 0 && { icon: "AlertTriangle", text: `${inventoryTotals.low} item(s) running low`, view: "shopInventory" },
    available > 0 && { icon: "Wallet", text: `${fmt(available)} available to pay out`, view: "shopPayouts" },
  ].filter(Boolean);
  return (
    <div className="relative">
      <IconBtn icon="Bell" label="Alerts" badge={items.length} onClick={() => setOpen((o) => !o)} />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-72 overflow-hidden" style={{ background: "#fff", border: `1px solid ${s.line}`, borderRadius: s.rPanel, boxShadow: "0 12px 30px rgba(16,32,42,.14)" }}>
            <p className="px-3.5 py-2.5 text-sm font-semibold" style={{ borderBottom: `1px solid ${s.lineSoft}`, color: s.text }}>Needs attention</p>
            {items.length === 0 ? <p className="px-3.5 py-4 text-sm" style={{ color: s.muted }}>You're all caught up.</p> : items.map((a) => (
              <button key={a.text} type="button" onClick={() => { nav(a.view); setOpen(false); }} className="w-full flex items-start gap-2.5 px-3.5 py-2.5 text-left hover:bg-black/[.03]">
                <Icon name={a.icon} size={15} className="mt-0.5 shrink-0" style={{ color: s.faint }} />
                <span className="text-sm" style={{ color: s.text }}>{a.text}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Account({ nav, locked }) {
  const s = useS();
  const { session, shopApplications, auth } = useApp();
  const { seller } = useShop();
  const [open, setOpen] = useState(false);
  const role = roleOf(session, shopApplications);
  const initials = (session.user.name || "?").split(" ").map((n) => n[0]).join("").slice(0, 2);
  const item = (icon, label, onClick, danger) => (
    <button type="button" onClick={() => { setOpen(false); onClick(); }} className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left hover:bg-black/[.03]" style={{ color: danger ? TONE.danger : s.text }}>
      <Icon name={icon} size={15} />{label}
    </button>
  );
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="Account menu" aria-expanded={open}
        className="w-9 h-9 inline-flex items-center justify-center text-xs font-semibold" style={{ background: s.accentSoft, color: s.accent, borderRadius: 999 }}>{initials}</button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-64 overflow-hidden" style={{ background: "#fff", border: `1px solid ${s.line}`, borderRadius: s.rPanel, boxShadow: "0 12px 30px rgba(16,32,42,.14)" }}>
            <div className="px-3.5 py-3" style={{ borderBottom: `1px solid ${s.lineSoft}` }}>
              <p className="text-sm font-semibold truncate" style={{ color: s.text }}>{session.user.name}</p>
              <p className="text-xs truncate" style={{ color: s.muted }}>{seller.name} · {role === "shop_owner" ? "Shop owner" : "Staff preview"}</p>
            </div>
            {!locked && <div className="px-3.5 py-2.5 lg:hidden" style={{ borderBottom: `1px solid ${s.lineSoft}` }}><PreviewSwitch full /></div>}
            {item("Settings", "Shop settings", () => nav("shopSettings"))}
            {item("ShoppingCart", "Switch to shopping", () => nav("home"))}
            {item("LogOut", "Sign out", async () => { await auth.logout(); nav("welcome"); }, true)}
          </div>
        </>
      )}
    </div>
  );
}

function PreviewSwitch({ full }) {
  const s = useS();
  const { sellers, dispatch } = useApp();
  const { seller } = useShop();
  return (
    <label className={`flex items-center gap-2 ${full ? "" : "hidden lg:flex"}`}>
      <span className="text-xs shrink-0" style={{ color: s.muted }}>Preview as</span>
      <Select value={seller.id} onChange={(e) => dispatch({ type: "SELLER_SWITCH", id: e.target.value })} aria-label="Preview as shop" className={full ? "" : "!w-48"}>
        {sellers.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
      </Select>
    </label>
  );
}

export default function SellerLayout({ view, nav, locked, children }) {
  const s = useS();
  const { seller, rows } = useShop();
  const [drawer, setDrawer] = useState(false);
  const [searching, setSearching] = useState(false);
  const open = rows.filter((r) => ["pending", "confirmed", "preparing", "ready"].includes(r.status.key)).length;

  return (
    <div className="seller-root min-h-screen" style={{ background: s.canvas, color: s.text, "--s-accent": s.accent }}>
      {/* Sidebar: icon rail on tablet, full on desktop */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-30 flex-col w-16 lg:w-60 py-4 px-2.5 lg:px-3" style={{ background: s.side }}>
        <div className="px-1 lg:px-2 mb-6 flex lg:block justify-center"><span className="lg:hidden"><Brand compact /></span><span className="hidden lg:block"><Brand /></span></div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <span className="hidden lg:block"><NavList view={view} nav={nav} /></span>
          <span className="lg:hidden block"><NavList view={view} nav={nav} showLabels={false} /></span>
        </div>
        <div className="hidden lg:block mt-3 p-3" style={{ background: "rgba(255,255,255,.07)", borderRadius: 8 }}>
          <p className="text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>Signed in to</p>
          <p className="text-sm font-semibold text-white truncate">{seller.name}</p>
          <button type="button" onClick={() => nav("home")} className="mt-2 text-xs font-medium inline-flex items-center gap-1.5 hover:underline" style={{ color: "rgba(255,255,255,.8)" }}>
            <Icon name="ShoppingCart" size={12} /> Switch to shopping
          </button>
        </div>
      </aside>

      <div className="md:pl-16 lg:pl-60">
        <header className="sticky top-0 z-30" style={{ background: s.panel, borderBottom: `1px solid ${s.line}`, paddingTop: "env(safe-area-inset-top)" }}>
          <div className="h-14 px-3 md:px-6 flex items-center gap-2 md:gap-4">
            <span className="md:hidden"><IconBtn icon="Menu" label="Open menu" onClick={() => setDrawer(true)} /></span>
            <span className="md:hidden s-heading font-bold text-[17px] truncate" style={{ color: s.side }}>Vyra <span className="font-medium text-xs" style={{ color: s.muted }}>Shop</span></span>
            <div className="hidden md:block flex-1"><TopSearch nav={nav} /></div>
            <div className="flex-1 md:hidden" />
            {!locked && <PreviewSwitch />}
            <span className="md:hidden"><IconBtn icon="Search" label="Search" onClick={() => setSearching((v) => !v)} /></span>
            <Alerts nav={nav} />
            <Account nav={nav} locked={locked} />
          </div>
          {searching && <div className="md:hidden px-3 pb-3"><TopSearch nav={nav} autoFocus onDone={() => setSearching(false)} /></div>}
        </header>

        <main className="px-4 md:px-6 py-5 pb-24 md:pb-10 max-w-[1440px] mx-auto min-w-0">{children}</main>
      </div>

      {/* Phone: the four sections used all day, plus the drawer for the rest */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-5" aria-label="Shop sections"
        style={{ background: s.panel, borderTop: `1px solid ${s.line}`, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.filter((n) => BOTTOM_NAV.includes(n.view)).map((n) => {
          const on = isActive(n, view);
          return (
            <button key={n.view} type="button" onClick={() => nav(n.view)} aria-current={on ? "page" : undefined} className="relative h-14 flex flex-col items-center justify-center gap-0.5" style={{ color: on ? s.accent : s.muted }}>
              <Icon name={n.icon} size={19} />
              <span className="text-[11px] font-medium">{n.label}</span>
              {n.badge && open > 0 && <span className="absolute top-1.5 left-1/2 ml-2 tnum min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center" style={{ background: TONE.warn, color: "#fff" }}>{open}</span>}
            </button>
          );
        })}
        <button type="button" onClick={() => setDrawer(true)} className="h-14 flex flex-col items-center justify-center gap-0.5" style={{ color: s.muted }}>
          <Icon name="Menu" size={19} /><span className="text-[11px] font-medium">More</span>
        </button>
      </nav>

      {drawer && (
        <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Shop menu">
          <div className="absolute inset-0" style={{ background: "rgba(16,32,42,.5)" }} onClick={() => setDrawer(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] flex flex-col py-4 px-3" style={{ background: s.side, paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
            <div className="flex items-center justify-between px-2 mb-5">
              <Brand />
              <button type="button" aria-label="Close menu" onClick={() => setDrawer(false)} className="w-8 h-8 inline-flex items-center justify-center" style={{ color: "rgba(255,255,255,.8)" }}><Icon name="X" size={18} /></button>
            </div>
            <div className="flex-1 overflow-y-auto"><NavList view={view} nav={nav} onPick={() => setDrawer(false)} /></div>
            <div className="mt-3 p-3 space-y-3" style={{ background: "rgba(255,255,255,.07)", borderRadius: 8 }}>
              <div><p className="text-[11px]" style={{ color: "rgba(255,255,255,.55)" }}>Signed in to</p><p className="text-sm font-semibold text-white truncate">{seller.name}</p></div>
              {!locked && <PreviewSwitch full />}
              <button type="button" onClick={() => { setDrawer(false); nav("home"); }} className="text-xs font-medium inline-flex items-center gap-1.5" style={{ color: "rgba(255,255,255,.85)" }}>
                <Icon name="ShoppingCart" size={12} /> Switch to shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
