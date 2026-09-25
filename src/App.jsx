import React, { Suspense, lazy, useCallback, useEffect, useState } from "react";
import { AppProvider, useApp, useC } from "./store/AppContext.jsx";
import { MobileHeader, DesktopHeader, BottomNav } from "./customer/layout/CustomerLayout.jsx";
import { Toasts, Spinner } from "./components/shared/ui.jsx";
import { areaOf, fromLocation, toPath } from "./services/router.js";

import Home from "./customer/pages/Home.jsx";
import Categories from "./customer/pages/Categories.jsx";
import Category from "./customer/pages/Category.jsx";
import Product from "./customer/pages/Product.jsx";
import Search from "./customer/pages/Search.jsx";
import Cart from "./customer/pages/Cart.jsx";
import Checkout from "./customer/pages/Checkout.jsx";
import OrderConfirmed from "./customer/pages/OrderConfirmed.jsx";
import Orders from "./customer/pages/Orders.jsx";
import OrderDetails from "./customer/pages/OrderDetails.jsx";
import Wishlist from "./customer/pages/Wishlist.jsx";
import Profile from "./customer/pages/Profile.jsx";
import Addresses from "./customer/pages/Addresses.jsx";
import PaymentMethods from "./customer/pages/PaymentMethods.jsx";
import Notifications from "./customer/pages/Notifications.jsx";
import Prescription from "./customer/pages/Prescription.jsx";
import Support from "./customer/pages/Support.jsx";
import Offers from "./customer/pages/Offers.jsx";
import Auth from "./customer/pages/Auth.jsx";

/* Everything that isn't the customer storefront is fetched only when opened. */
const Admin = lazy(() => import("./admin/Dashboard.jsx"));
const Pharmacy = lazy(() => import("./pharmacy/Prescriptions.jsx"));
const Delivery = lazy(() => import("./delivery/DeliveryOrders.jsx"));
const POS = lazy(() => import("./pos/POS.jsx"));
const SellerApp = lazy(() => import("./seller/SellerApp.jsx"));
const ApplicantLayout = lazy(() => import("./seller/layout/ApplicantLayout.jsx"));
const ShopOnboarding = lazy(() => import("./seller/onboarding/Onboarding.jsx"));
const ShopApplicationStatus = lazy(() => import("./seller/onboarding/ApplicationStatus.jsx"));

const TITLES = { customer: "Vyra", shop: "Vyra Shop Manager", apply: "Register your shop · Vyra", staff: "Vyra Console", bare: "Vyra" };

/** Turn any (view, params) into the canonical route the URL describes. */
function canonical(view, params) {
  const [path, qs = ""] = toPath(view, params).split("?");
  return { url: qs ? `${path}?${qs}` : path, ...fromLocation(path, qs ? `?${qs}` : "") };
}

function Shell() {
  const C = useC();
  const { session } = useApp();
  const [route, setRoute] = useState(() => {
    const fromUrl = typeof window !== "undefined" ? fromLocation(window.location.pathname, window.location.search) : null;
    return { ...(fromUrl || { view: session.signedIn ? "home" : "welcome", params: {} }), id: 0 };
  });
  const [query, setQuery] = useState("");

  const nav = useCallback((view, params = {}) => {
    const next = canonical(view, params);
    const current = window.location.pathname + window.location.search;
    window.history[current === next.url ? "replaceState" : "pushState"]({}, "", next.url);
    setRoute((r) => ({ view: next.view, params: next.params, id: r.id + 1 }));
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  /* Keep the address bar and the app in step (also normalises "/" and unknown paths). */
  useEffect(() => {
    window.history.replaceState({}, "", canonical(route.view, route.params).url);
    const onPop = () => {
      const parsed = fromLocation(window.location.pathname, window.location.search) || { view: "welcome", params: {} };
      setRoute((r) => ({ ...parsed, id: r.id + 1 }));
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const { view, params } = route;
  const area = areaOf(view);
  useEffect(() => { document.title = TITLES[area] || "Vyra"; }, [area]);

  const customerPage = () => {
    switch (view) {
      case "home": return <Home nav={nav} />;
      case "categories": return <Categories nav={nav} />;
      case "category": return <Category nav={nav} params={params} />;
      case "product": return <Product nav={nav} params={params} />;
      case "search": return <Search nav={nav} params={params} query={query} setQuery={setQuery} />;
      case "cart": return <Cart nav={nav} />;
      case "checkout": return <Checkout nav={nav} />;
      case "orderConfirmed": return <OrderConfirmed nav={nav} params={params} />;
      case "orders": return <Orders nav={nav} />;
      case "orderDetails": return <OrderDetails nav={nav} params={params} />;
      case "wishlist": return <Wishlist nav={nav} />;
      case "profile": return <Profile nav={nav} />;
      case "addresses": return <Addresses nav={nav} />;
      case "payment": return <PaymentMethods nav={nav} />;
      case "notifications": return <Notifications nav={nav} />;
      case "prescription": return <Prescription nav={nav} params={params} />;
      case "support": return <Support nav={nav} params={params} />;
      case "offers": return <Offers nav={nav} />;
      case "admin": return <Lazy><Admin nav={nav} params={params} /></Lazy>;
      case "pharmacy": return <Lazy><Pharmacy nav={nav} /></Lazy>;
      case "delivery": return <Lazy><Delivery nav={nav} /></Lazy>;
      default: return <Home nav={nav} />;
    }
  };

  let body;
  if (area === "shop") {
    /* Seller dashboard: its own shell, its own navigation, its own access check. */
    body = <Lazy><SellerApp key={route.id} view={view} params={params} nav={nav} /></Lazy>;
  } else if (area === "apply") {
    body = (
      <Lazy><ApplicantLayout nav={nav}>
        {view === "shopOnboarding" ? <ShopOnboarding key={route.id} nav={nav} params={params} /> : <ShopApplicationStatus key={route.id} nav={nav} params={params} />}
      </ApplicantLayout></Lazy>
    );
  } else if (view === "welcome") {
    body = <Auth nav={nav} />;
  } else if (view === "pos") {
    body = <Lazy><POS nav={nav} /></Lazy>;
  } else {
    body = (
      <>
        <MobileHeader nav={nav} query={query} setQuery={setQuery} />
        <DesktopHeader nav={nav} view={view} query={query} setQuery={setQuery} />
        <div key={route.id}>{customerPage()}</div>
        <BottomNav view={view} nav={nav} />
      </>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      {body}
      <Toasts />
    </div>
  );
}

function Lazy({ children }) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-24"><Spinner size={26} /></div>}>
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
