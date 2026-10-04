import React, { useEffect } from "react";
import { useApp } from "../store/AppContext.jsx";
import { resolveSeller, isAdmin } from "../services/access.js";
import { SELLERS } from "../data/sellers.js";
import { ShopCtx, useShopData } from "./hooks/useShopData.js";
import SellerLayout from "./layout/SellerLayout.jsx";
import ShopGate from "./layout/ShopGate.jsx";

import Dashboard from "./pages/Dashboard.jsx";
import Products from "./pages/Products.jsx";
import Inventory from "./pages/Inventory.jsx";
import Orders from "./pages/Orders.jsx";
import Customers from "./pages/Customers.jsx";
import Sales from "./pages/Sales.jsx";
import Offers from "./pages/Offers.jsx";
import Payouts from "./pages/Payouts.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

const PAGES = {
  shopDashboard: Dashboard, shopProducts: Products, shopInventory: Inventory,
  shopOrders: Orders, shopOrderDetails: Orders, shopCustomers: Customers,
  shopSales: Sales, shopOffers: Offers, shopPayouts: Payouts, shopReports: Reports, shopSettings: Settings,
};

function Workspace({ seller, locked, view, params, nav }) {
  const data = useShopData(seller);
  const Page = PAGES[view] || Dashboard;
  return (
    <ShopCtx.Provider value={data}>
      <SellerLayout view={view} nav={nav} locked={locked}>
        <Page nav={nav} params={params} />
      </SellerLayout>
    </ShopCtx.Provider>
  );
}

/** Entry point for everything under /shop/*. Access is decided here, once,
    from the existing session — so no seller page can render for someone who
    isn't allowed to see it. */
export default function SellerApp({ view, params, nav }) {
  const { session, shopApplications, sellers, currentSellerId, catalog, dispatch } = useApp();
  // Admins always have Vyra Center in the shop list, even before the sellers API has answered (or if it failed).
  const needsVyra = isAdmin(session) && !sellers.some((x) => x.firstParty);
  useEffect(() => { if (needsVyra) dispatch({ type: "SELLERS_LOADED", sellers: SELLERS.filter((x) => x.firstParty) }); }, [needsVyra]); // eslint-disable-line react-hooks/exhaustive-deps
  const resolved = resolveSeller({ session, shopApplications, sellers, currentSellerId });
  const viewedId = resolved?.seller?.id;
  const staffView = !!resolved && !resolved.locked;
  // Staff (admins) opening a shop need that shop's complete product list, not just the capped storefront preload.
  useEffect(() => { if (staffView && viewedId) catalog.loadShopListings(viewedId); }, [staffView, viewedId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!resolved) return <ShopGate reason="not_shop_owner" nav={nav} />;
  if (resolved.seller.status !== "active") return <ShopGate reason={resolved.seller.status} seller={resolved.seller} nav={nav} />;
  return <Workspace seller={resolved.seller} locked={resolved.locked} view={view} params={params} nav={nav} />;
}
