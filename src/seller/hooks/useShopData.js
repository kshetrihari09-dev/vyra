import { createContext, useContext, useMemo } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { sellerListings, sellerEarnings } from "../../utils/sellerOrders.js";
import { buildOrderRows, inventoryRowsFor, inventoryTotals, buildCustomers } from "../../services/sellerAnalytics.js";

/* Everything a shop page needs, derived once per state change from the same
   products / orders / stock movements the customer app uses. */
export const ShopCtx = createContext(null);
export const useShop = () => useContext(ShopCtx);

export function useShopData(seller) {
  const { products, orders, stockMovements, sellerPayouts, categories } = useApp();
  return useMemo(() => {
    const listings = sellerListings(products, seller.id);
    const ids = new Set(listings.map((p) => p.id));
    const rows = buildOrderRows(orders, products, seller.id);
    const earnings = sellerEarnings(orders, products, seller);
    const history = sellerPayouts.filter((p) => p.sellerId === seller.id);
    // "Paid out" is only what's actually been paid; anything requested-but-not-yet-decided is committed (it
    // comes off what's available) without being reported as money that has arrived.
    const paidOut = history.filter((p) => !p.status || p.status === "paid").reduce((s, p) => s + p.amount, 0);
    const committed = history.filter((p) => p.status !== "rejected").reduce((s, p) => s + p.amount, 0);
    const movements = stockMovements.filter((m) => ids.has(m.productId));
    const inventory = inventoryRowsFor(listings, movements);
    return {
      seller, listings, rows, earnings, payouts: history, paidOut,
      available: Math.max(Math.round((earnings.net - committed) * 100) / 100, 0),
      movements, inventory, inventoryTotals: inventoryTotals(inventory),
      customers: buildCustomers(rows), categories,
    };
  }, [seller, products, orders, stockMovements, sellerPayouts, categories]);
}
