import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from "react";
import { AppProvider, useApp, useC } from "./store/AppContext.jsx";
import { MobileHeader, DesktopHeader, BottomNav } from "./customer/layout/CustomerLayout.jsx";
import { Toasts, Spinner } from "./components/shared/ui.jsx";
import { areaOf, fromLocation, toPath } from "./services/router.js";
import { availableWorkspaces, rememberable, requiresSignIn, resolveDestination } from "./services/workspaces.js";
import { createLastStore } from "./services/lastWorkspace.js";
import { resolvePostLogin } from "./services/postLogin.js";
import { deliveryApi } from "./services/api/deliveryApi.js";
import { inFlightDelivery } from "./delivery/runFlow.js";
import AccessDenied from "./components/shared/AccessDenied.jsx";
import { Logo } from "./components/shared/Logo.jsx";

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
import BecomeRider from "./customer/pages/BecomeRider.jsx";
import PaymentMethods from "./customer/pages/PaymentMethods.jsx";
import Notifications from "./customer/pages/Notifications.jsx";
import Prescription from "./customer/pages/Prescription.jsx";
import Support from "./customer/pages/Support.jsx";
import Offers from "./customer/pages/Offers.jsx";
import Auth from "./customer/pages/Auth.jsx";

/* Everything that isn't the customer storefront is fetched only when opened. */
const Admin = lazy(() => import("./admin/Dashboard.jsx"));
import AdminGate from "./admin/AdminGate.jsx";
import RiderRestricted from "./delivery/RiderRestricted.jsx";
import { canUseRiderApp, hasPermission, isAdmin, ownedSellerId } from "./services/access.js";
const Pharmacy = lazy(() => import("./pharmacy/Prescriptions.jsx"));
const TrackOrder = lazy(() => import("./customer/pages/TrackOrder.jsx"));
const Delivery = lazy(() => import("./delivery/DeliveryOrders.jsx"));
const WorkspaceHub = lazy(() => import("./workspaces/WorkspaceHub.jsx"));
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

/* The rider's in-flight delivery, for the one case that needs asking the server (a rider who also has other workspaces). */
const lookupActiveDelivery = async () => inFlightDelivery(await deliveryApi.mine("active"));

function Shell() {
  const C = useC();
  const { session, shopApplications, signOutReason } = useApp();
  const lastStore = useMemo(() => createLastStore(), []);
  const ownsShop = !!ownedSellerId(session, shopApplications);
  const [route, setRoute] = useState(() => {
    const fromUrl = typeof window !== "undefined" ? fromLocation(window.location.pathname, window.location.search) : null;
    if (fromUrl) return { ...fromUrl, id: 0 };            // an explicit URL (deep link, reload, bookmark) always wins
    if (!session.signedIn) return { view: "welcome", params: {}, id: 0 };
    // Opened at "/" with a restored session: same single decision as signing in (no stop at the storefront). Synchronous — no request.
    const dest = resolveDestination({ principal: session, userId: session.user.uuid, ownsShop, last: lastStore.read(session.user.uuid) });
    return { view: dest.view, params: dest.params, id: 0 };
  });
  const [query, setQuery] = useState("");

  const nav = useCallback((view, params = {}) => {
    const next = canonical(view, params);
    const current = window.location.pathname + window.location.search;
    window.history[current === next.url ? "replaceState" : "pushState"]({}, "", next.url);
    setRoute((r) => ({ view: next.view, params: next.params, id: r.id + 1 }));
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }, []);

  /* Like nav(), but replaces the history entry: for redirects (sign-in, post-login) that must not leave a page to Back into. */
  const replaceRoute = useCallback((view, params = {}) => {
    const next = canonical(view, params);
    window.history.replaceState({}, "", next.url);
    setRoute((r) => ({ view: next.view, params: next.params, id: r.id + 1 }));
  }, []);

  /* "Continue where you left off": remember meaningful workspace screens only (workspaces.rememberable is the allowlist), and only
     those this account is authorised for. Stored per account; never used as permission. */
  const remember = useCallback((view, params) => {
    if (!session.signedIn || !session.user.uuid) return;
    const entry = rememberable(view, params, availableWorkspaces(session, { ownsShop }));
    if (entry) lastStore.write(session.user.uuid, entry);
  }, [session, ownsShop, lastStore]);
  useEffect(() => { remember(route.view, route.params); }, [route.id, remember]); // eslint-disable-line react-hooks/exhaustive-deps

  /* A screen that changes WHICH page it is (a rider opening a run) without remounting: update the address bar + remembered screen only. */
  const syncRoute = useCallback((view, params = {}) => {
    window.history.replaceState({}, "", canonical(view, params).url);
    remember(view, params);
  }, [remember]);

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

  /* Protected screen while signed out → sign in, then come back. An EXPIRED session returns to this very page; an explicit sign-out never
     leaves a destination behind for whoever uses the device next. (/admin keeps its own inline sign-in, AdminGate.) */
  const needsSignIn = !session.signedIn && requiresSignIn(view);
  useEffect(() => {
    if (!needsSignIn) return;
    const back = signOutReason === "user" ? null : window.location.pathname + window.location.search;
    replaceRoute("welcome", back ? { next: back } : {});
  }, [needsSignIn]); // eslint-disable-line react-hooks/exhaustive-deps

  /* Signed in and sitting on the login page (just signed in, or Back/bookmark): THE post-login decision — one resolve, one replace. */
  const resolvingLogin = session.signedIn && view === "welcome";
  useEffect(() => {
    if (!resolvingLogin) return undefined;
    let alive = true;
    resolvePostLogin({ session, ownsShop, next: params.next || null, last: lastStore.read(session.user.uuid), lookupActive: lookupActiveDelivery })
      .then((dest) => { if (alive) replaceRoute(dest.view, dest.params); });
    return () => { alive = false; };
  }, [resolvingLogin]); // eslint-disable-line react-hooks/exhaustive-deps
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
      case "trackOrder": return <Lazy><TrackOrder nav={nav} params={params} /></Lazy>;
      case "wishlist": return <Wishlist nav={nav} />;
      case "profile": return <Profile nav={nav} />;
      case "addresses": return <Addresses nav={nav} />;
      case "becomeRider": return <BecomeRider nav={nav} />;
      case "payment": return <PaymentMethods nav={nav} />;
      case "notifications": return <Notifications nav={nav} />;
      case "prescription": return <Prescription nav={nav} params={params} />;
      case "support": return <Support nav={nav} params={params} />;
      case "offers": return <Offers nav={nav} />;
      case "admin": return isAdmin(session) ? <Lazy><Admin nav={nav} params={params} /></Lazy> : <AdminGate signedIn={session.signedIn} nav={nav} />;
      case "pharmacy": return <Lazy><Pharmacy nav={nav} /></Lazy>;
      case "delivery":
      case "deliveryRun": return canUseRiderApp(session) ? <Lazy><Delivery nav={nav} params={params} sync={syncRoute} /></Lazy> : <RiderRestricted nav={nav} />;
      default: return <Home nav={nav} />;
    }
  };

  let body;
  if (needsSignIn || resolvingLogin) {
    body = <OpeningScreen />; // one short loading state, never a flash of the wrong page
  } else if (area === "shop") {
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
  } else if (view === "workspaces") {
    body = <Lazy><WorkspaceHub nav={nav} /></Lazy>;
  } else if (view === "pos") {
    body = hasPermission(session, "pos:sell")
      ? <Lazy><POS nav={nav} /></Lazy>
      : <AccessDenied nav={nav} title="Point of Sale is restricted" body="This area is for staff with point-of-sale access." />;
  } else if (view === "pharmacy" && !hasPermission(session, "prescriptions:review")) {
    body = <AccessDenied nav={nav} title="Pharmacist console is restricted" body="This area is for staff who review prescriptions." />;
  } else {
    body = (
      <>
        <MobileHeader nav={nav} view={view} query={query} setQuery={setQuery} />
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

function OpeningScreen() {
  const C = useC();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: C.bg }} role="status" aria-live="polite">
      <Logo />
      <Spinner size={26} />
      <p className="text-sm" style={{ color: C.muted }}>Opening your workspace…</p>
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
