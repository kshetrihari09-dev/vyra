import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useRef, useState } from "react";
import { THEMES } from "../theme.js";
import { productById } from "../data/products.js";
import { STORES } from "../data/stores.js";
import { notificationsApi } from "../services/api/notificationsApi.js";
import { priceOf } from "../utils/pricing.js";
import { maxAddable } from "../utils/inventory.js";
import { authApi } from "../services/api/authApi.js";
import { setSessionLostHandler } from "../services/api/client.js";
import { catalogApi } from "../services/api/catalogApi.js";
import { productsApi } from "../services/api/productsApi.js";
import { hydrateRegistries } from "../services/catalogRegistry.js";
import { addressesApi } from "../services/api/addressesApi.js";
import { cartApi } from "../services/api/cartApi.js";
import { ordersApi } from "../services/api/ordersApi.js";
import { wishlistApi } from "../services/api/wishlistApi.js";
import { prescriptionsApi } from "../services/api/prescriptionsApi.js";
import { paymentsApi } from "../services/api/paymentsApi.js";
import { sellersApi } from "../services/api/sellersApi.js";
import { shopApplicationsApi } from "../services/api/shopApplicationsApi.js";

/** How many products to warm the cache with at startup. Browse, search and product pages are server-driven and
    fetch the rest on demand; the console/analytics screens that still compute over `products` (dashboards, reports,
    low-stock) only see this many until their own server endpoints arrive (Phase 4 / Phase 8). */
const CATALOG_PRELOAD = 100;

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
/** Theme tokens. Colours come from state, so every consumer re-renders on change. */
export const useC = () => useContext(AppCtx).C;

const lineKey = (productId, variantId) => `${productId}:${variantId || "-"}`;

const GUEST_USER = { id: null, name: "Guest", email: "", phone: "", emailVerified: false, phoneVerified: false, memberSince: null, orderCount: 0 };
const GUEST_SESSION = { signedIn: false, user: GUEST_USER, role: "customer", roles: [], permissions: [], isStaff: false, shopOwnerSellerId: null };

/** Maps the API's user DTO onto the session shape the existing screens read.
    INTERIM BRIDGE (removed in Phase 3): the demo customer keeps its prototype id ("cus-1001") so the
    still-local demo orders keep matching; the real uuid is kept as `uuid`. */
const sessionFromApiUser = (u) => ({
  signedIn: true,
  role: (u.roles || [])[0] || "customer",
  roles: u.roles || [],
  permissions: u.permissions || [],
  isStaff: !!u.isStaff,
  shopOwnerSellerId: u.sellerId ?? null, // the shop this account owns — real, from the API (was always null before Phase 6)
  user: { ...GUEST_USER, id: u.legacyId || u.id, uuid: u.id, name: u.name, email: u.email || "", phone: u.mobile || "",
    emailVerified: !!u.emailVerified, phoneVerified: !!u.phoneVerified, memberSince: u.memberSince },
});

const initial = {
  themeKey: "teal",
  storeId: STORES[0].id,
  /* Identity now comes from the backend (POST /auth/login, /auth/register/verify, and the refresh
     cookie on page load). `isStaff` only decides whether back-office links are SHOWN — the API
     re-checks roles/permissions from the database on every protected request and never trusts it.
     shopOwnerSellerId is derived from approved shop applications until the seller API arrives (Phase 6). */
  session: GUEST_SESSION,
  registeredMobiles: [],
  registeredEmails: [],
  shopApplications: [], // local drafts + the caller's (or, for staff, every) server-side application — see loadCommerce
  cart: [],
  saved: [],
  wishlist: [], // loaded from the API for signed-in customers (see loadCommerce)
  /* Catalogue: a CACHE of what the API returned (see loadCatalog). Empty until the first load completes. */
  categories: [],
  products: [],
  catalogVersion: 0,
  catalogTotal: 0,
  addresses: [], // loaded from the API once signed in (see loadCommerce)
  cards: [],
  orders: [], // loaded from the API — customers see their own, staff with orders:read_all see everything
  prescriptions: [], // loaded from the API for signed-in customers/pharmacists (see loadCommerce)
  notifications: [],   // loaded from the API for signed-in users (see loadNotifications); local until then
  notificationsUnread: 0,
  recentlyViewed: [],
  recentSearches: [],
  coupon: null,
  sellers: [],
  sellerPayouts: [],
  currentSellerId: null,
  purchaseOrders: [],
  stockMovements: [],
  toasts: [],
  auditLog: [],
};

export function reducer(state, action) {
  switch (action.type) {
    case "THEME": return { ...state, themeKey: action.key };
    case "STORE": return { ...state, storeId: action.id };
    case "SESSION_SET": return { ...state, session: sessionFromApiUser(action.user) };
    case "SIGN_OUT": return { ...state, session: GUEST_SESSION };

    case "CART_ADD": {
      const key = lineKey(action.productId, action.variantId);
      const product = productById(action.productId, state.products);
      const cap = maxAddable(product, action.variantId, state.storeId);
      const existing = state.cart.find((l) => l.key === key);
      const qty = Math.min((existing?.qty || 0) + action.qty, Math.max(cap, 1));
      const cart = existing
        ? state.cart.map((l) => (l.key === key ? { ...l, qty } : l))
        : [...state.cart, { key, productId: action.productId, variantId: action.variantId || null, qty }];
      return { ...state, cart };
    }
    case "CART_SET_QTY": {
      const cart = state.cart.map((l) => (l.key === action.key ? { ...l, qty: action.qty } : l)).filter((l) => l.qty > 0);
      return { ...state, cart };
    }
    case "CART_REMOVE": return { ...state, cart: state.cart.filter((l) => l.key !== action.key) };
    case "CART_CLEAR": return { ...state, cart: [], coupon: null };
    case "CART_SAVE_LATER": {
      const line = state.cart.find((l) => l.key === action.key);
      if (!line) return state;
      return { ...state, cart: state.cart.filter((l) => l.key !== action.key), saved: [...state.saved, line] };
    }
    case "CART_MOVE_BACK": {
      const line = state.saved.find((l) => l.key === action.key);
      if (!line) return state;
      return { ...state, saved: state.saved.filter((l) => l.key !== action.key), cart: [...state.cart, line] };
    }
    case "SAVED_REMOVE": return { ...state, saved: state.saved.filter((l) => l.key !== action.key) };
    case "COUPON": return { ...state, coupon: action.code };

    case "WISHLIST_SET": return { ...state, wishlist: action.productIds };
    case "WISHLIST_ADD_LOCAL": return state.wishlist.includes(action.productId) ? state : { ...state, wishlist: [action.productId, ...state.wishlist] };
    case "WISHLIST_REMOVE_LOCAL": return { ...state, wishlist: state.wishlist.filter((id) => id !== action.productId) };
    case "VIEWED": return { ...state, recentlyViewed: [action.id, ...state.recentlyViewed.filter((x) => x !== action.id)].slice(0, 10) };
    case "SEARCHED": {
      const q = action.q.trim();
      if (!q) return state;
      return { ...state, recentSearches: [q, ...state.recentSearches.filter((x) => x !== q)].slice(0, 8) };
    }
    case "SEARCH_CLEAR": return { ...state, recentSearches: [] };

    // Addresses/orders now come from the API — these reducers apply the server's response, they never invent one.
    case "ADDRESSES_LOADED": return { ...state, addresses: action.addresses };
    case "ADDRESS_UPSERT": return { ...state, addresses: [action.address, ...state.addresses.filter((a) => a.id !== action.address.id)].map((a) => ({ ...a, isDefault: action.address.isDefault && a.id !== action.address.id ? false : a.isDefault })) };
    case "ADDRESS_REMOVE": return { ...state, addresses: state.addresses.filter((a) => a.id !== action.id) };

    case "ORDERS_LOADED": return { ...state, orders: action.orders };
    case "ORDER_UPSERT": return { ...state, orders: [action.order, ...state.orders.filter((o) => o.id !== action.order.id)], cart: action.clearCart ? [] : state.cart, coupon: action.clearCart ? null : state.coupon };
    /** POS checkout: creates the order AND decrements stock in one atomic step,
        pulling from the earliest-expiry batch first for batch-tracked items. */
    case "SALE_COMPLETE": {
      const { order, user } = action;
      const movements = [];
      let products = state.products;
      order.items.forEach((it) => {
        products = products.map((p) => {
          if (p.id !== it.productId) return p;
          if (it.variantId) {
            movements.push({ id: `mv-${Date.now()}-${p.id}-${it.variantId}-${Math.random()}`, at: order.placedAt, user, productId: p.id, variantId: it.variantId, storeId: order.storeId, delta: -it.qty, reason: `POS sale · ${order.number}`, prevQty: null, newQty: null, batch: null });
            return { ...p, variants: p.variants.map((v) => v.id === it.variantId ? { ...v, stock: { ...v.stock, [order.storeId]: Math.max((v.stock?.[order.storeId] || 0) - it.qty, 0) } } : v) };
          }
          const prevQty = p.stock?.[order.storeId] || 0;
          const newQty = Math.max(prevQty - it.qty, 0);
          let batches = p.batches;
          if (p.batches?.length) {
            let remaining = it.qty;
            batches = [...p.batches].sort((a, b) => new Date(a.expiry) - new Date(b.expiry)).map((b) => {
              if (remaining <= 0) return b;
              const take = Math.min(b.qty, remaining);
              remaining -= take;
              movements.push({ id: `mv-${Date.now()}-${p.id}-${b.batch}-${Math.random()}`, at: order.placedAt, user, productId: p.id, variantId: null, storeId: order.storeId, delta: -take, reason: `POS sale · ${order.number}`, prevQty: b.qty, newQty: b.qty - take, batch: b.batch });
              return { ...b, qty: b.qty - take };
            }).filter((b) => b.qty > 0);
          } else {
            movements.push({ id: `mv-${Date.now()}-${p.id}-${Math.random()}`, at: order.placedAt, user, productId: p.id, variantId: null, storeId: order.storeId, delta: -it.qty, reason: `POS sale · ${order.number}`, prevQty, newQty, batch: null });
          }
          return { ...p, stock: { ...p.stock, [order.storeId]: newQty }, batches };
        });
      });
      return { ...state, products, orders: [order, ...state.orders], stockMovements: [...movements, ...state.stockMovements].slice(0, 300) };
    }
    case "ORDER_ADVANCE": {
      const orders = state.orders.map((o) =>
        o.id === action.id ? { ...o, status: action.status, history: [...o.history, { status: action.status, at: new Date().toISOString() }], ...(action.patch || {}) } : o);
      return { ...state, orders };
    }
    case "ORDER_CANCEL":
      return { ...state, orders: state.orders.map((o) => (o.id === action.id ? { ...o, status: "cancelled", history: [...o.history, { status: "cancelled", at: new Date().toISOString() }] } : o)) };

    case "PRESCRIPTIONS_LOADED": return { ...state, prescriptions: action.prescriptions };
    case "PRESCRIPTION_UPSERT": return { ...state, prescriptions: [action.prescription, ...state.prescriptions.filter((r) => r.id !== action.prescription.id)] };

    /* ---------------------------- SHOP REGISTRATION ---------------------------- */
    /** Upserts a draft as the owner moves through the wizard — nothing is lost
        moving back and forth between steps. */
    case "SHOP_APP_SAVE": {
      const exists = state.shopApplications.some((a) => a.id === action.application.id);
      const shopApplications = exists
        ? state.shopApplications.map((a) => (a.id === action.application.id ? action.application : a))
        : [action.application, ...state.shopApplications];
      return { ...state, shopApplications };
    }
    /** Server-side applications. Local drafts (never submitted, not fromServer) are kept as-is; everything else
        is replaced by what the API says. `replacesId` swaps a just-submitted local draft for its server copy. */
    case "SHOP_APPS_LOADED": return { ...state, shopApplications: [...action.applications, ...state.shopApplications.filter((a) => !a.fromServer && a.status === "draft")] };
    case "SHOP_APP_SERVER_UPSERT": {
      const rest = state.shopApplications.filter((a) => a.id !== action.application.id && a.id !== action.replacesId);
      return { ...state, shopApplications: [action.application, ...rest] };
    }
    case "SHOP_APP_DOC_VERIFY": {
      const shopApplications = state.shopApplications.map((a) => (a.id !== action.appId ? a : { ...a, documents: a.documents.map((d) => (d.id === action.docId ? { ...d, verificationStatus: action.status, rejectionReason: action.status === "rejected" ? action.reason : null } : d)) }));
      return { ...state, shopApplications };
    }
    case "SELLERS_LOADED": {
      const byId = new Map(state.sellers.map((s) => [s.id, s]));
      for (const s of action.sellers) byId.set(s.id, { ...byId.get(s.id), ...s });
      return { ...state, sellers: [...byId.values()] };
    }
    case "SELLER_PAYOUTS_LOADED": return { ...state, sellerPayouts: action.payouts };
    case "SELLER_PAYOUT_UPSERT": return { ...state, sellerPayouts: [action.payout, ...state.sellerPayouts.filter((p) => p.id !== action.payout.id)] };

    case "NOTIFICATIONS_LOADED": return { ...state, notifications: action.notifications, notificationsUnread: action.unread };
    case "NOTIFICATION_READ": return { ...state, notifications: state.notifications.map((n) => (n.id === action.id ? { ...n, unread: false } : n)), notificationsUnread: action.unread };
    case "NOTIFY_READ": return { ...state, notifications: state.notifications.map((n) => ({ ...n, unread: false })), notificationsUnread: 0 };

    case "CATALOG_LOADED": {
      // The public preload only returns active products. Keep the signed-in shop's own pending/inactive/rejected
      // listings that are already cached, otherwise a catalogue reload silently erases them from Seller Console.
      const own = state.session.shopOwnerSellerId;
      const incoming = new Set(action.products.map((p) => p.id));
      const kept = own ? state.products.filter((p) => p.sellerId === own && !incoming.has(p.id)) : [];
      return { ...state, categories: action.categories, products: [...action.products, ...kept], catalogTotal: action.total, catalogVersion: state.catalogVersion + 1 };
    }
    case "CATEGORIES_SET": return { ...state, categories: action.categories, catalogVersion: state.catalogVersion + 1 };
    case "PRODUCTS_UPSERT": {
      // Merge fetched rows into the cache: replace in place, append the new ones. The server's copy wins.
      const incoming = new Map(action.products.map((p) => [p.id, p]));
      const merged = state.products.map((p) => incoming.get(p.id) ?? p);
      const known = new Set(state.products.map((p) => p.id));
      return { ...state, products: [...merged, ...action.products.filter((p) => !known.has(p.id))], catalogVersion: state.catalogVersion + 1 };
    }
    case "PRODUCT_UPDATE": return { ...state, products: state.products.map((p) => (p.id === action.product.id ? action.product : p)) };
    case "PRODUCT_ADD": return { ...state, products: [action.product, ...state.products] };
    case "PRODUCT_REMOVE": return { ...state, products: state.products.filter((p) => p.id !== action.id) };
    case "STOCK_ADJUST": {
      let prevQty = 0, newQty = 0;
      const products = state.products.map((p) => {
        if (p.id !== action.productId) return p;
        if (action.variantId) {
          return { ...p, variants: p.variants.map((v) => {
            if (v.id !== action.variantId) return v;
            prevQty = v.stock?.[action.storeId] || 0;
            newQty = Math.max(prevQty + action.delta, 0);
            return { ...v, stock: { ...v.stock, [action.storeId]: newQty } };
          }) };
        }
        prevQty = p.stock?.[action.storeId] || 0;
        newQty = Math.max(prevQty + action.delta, 0);
        return { ...p, stock: { ...p.stock, [action.storeId]: newQty } };
      });
      const movement = {
        id: `mv-${Date.now()}-${Math.floor(Math.random() * 1000)}`, at: new Date().toISOString(),
        user: action.user || "System", productId: action.productId, variantId: action.variantId || null,
        storeId: action.storeId, delta: action.delta, reason: action.reason || "Manual adjustment",
        prevQty, newQty, batch: action.batch || null,
      };
      return { ...state, products, stockMovements: [movement, ...state.stockMovements].slice(0, 300) };
    }
    case "STOCK_TRANSFER": {
      const { productId, variantId, fromStoreId, toStoreId, qty, user } = action;
      let products = state.products;
      const applyDelta = (list, storeId, delta) => list.map((p) => {
        if (p.id !== productId) return p;
        if (variantId) return { ...p, variants: p.variants.map((v) => v.id === variantId ? { ...v, stock: { ...v.stock, [storeId]: Math.max((v.stock?.[storeId] || 0) + delta, 0) } } : v) };
        return { ...p, stock: { ...p.stock, [storeId]: Math.max((p.stock?.[storeId] || 0) + delta, 0) } };
      });
      products = applyDelta(products, fromStoreId, -qty);
      products = applyDelta(products, toStoreId, qty);
      const now = new Date().toISOString();
      const movements = [
        { id: `mv-${Date.now()}-out`, at: now, user, productId, variantId: variantId || null, storeId: fromStoreId, delta: -qty, reason: `Transfer to ${toStoreId}`, prevQty: null, newQty: null },
        { id: `mv-${Date.now()}-in`, at: now, user, productId, variantId: variantId || null, storeId: toStoreId, delta: qty, reason: `Transfer from ${fromStoreId}`, prevQty: null, newQty: null },
      ];
      return { ...state, products, stockMovements: [...movements, ...state.stockMovements].slice(0, 300) };
    }

    case "PO_CREATE": return { ...state, purchaseOrders: [action.po, ...state.purchaseOrders] };
    case "PO_RECEIVE": {
      const { poId, receivedLines, user } = action; // receivedLines: [{productId, qty, purchasePrice, batch, expiry}]
      let products = state.products;
      const movements = [];
      receivedLines.forEach((line) => {
        products = products.map((p) => {
          if (p.id !== line.productId) return p;
          const prevQty = p.stock?.[action.storeId] || 0;
          const newQty = prevQty + line.qty;
          const batches = [...(p.batches || []), { batch: line.batch, expiry: line.expiry, qty: line.qty, cost: line.purchasePrice }];
          movements.push({ id: `mv-${Date.now()}-${line.productId}`, at: new Date().toISOString(), user, productId: p.id, variantId: null, storeId: action.storeId, delta: line.qty, reason: `Goods received · ${poId}`, prevQty, newQty, batch: line.batch });
          return { ...p, stock: { ...p.stock, [action.storeId]: newQty }, batches };
        });
      });
      const purchaseOrders = state.purchaseOrders.map((po) => po.id === poId ? { ...po, status: "received", receivedAt: new Date().toISOString(), lines: receivedLines } : po);
      return { ...state, products, purchaseOrders, stockMovements: [...movements, ...state.stockMovements].slice(0, 300) };
    }

    case "SELLER_SWITCH": return { ...state, currentSellerId: action.id };
    case "SELLER_UPDATE": return { ...state, sellers: state.sellers.map((s) => (s.id === action.seller.id ? action.seller : s)) };
    case "SELLER_STATUS": return { ...state, sellers: state.sellers.map((s) => (s.id === action.id ? { ...s, status: action.status } : s)) };

    case "AUDIT": return { ...state, auditLog: [{ id: `a${Date.now()}`, at: new Date().toISOString(), ...action.entry }, ...state.auditLog].slice(0, 50) };
    case "TOAST_ADD": return { ...state, toasts: [...state.toasts, action.toast].slice(-3) };
    case "TOAST_REMOVE": return { ...state, toasts: state.toasts.filter((t) => t.id !== action.id) };
    default: return state;
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const toastSeq = useRef(0);
  const [authReady, setAuthReady] = useState(false);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogError, setCatalogError] = useState(null);

  /* On load, trade the httpOnly refresh cookie for a session; render nothing until we know who (if anyone)
     is signed in so the first route is chosen correctly. A server that's down just means "signed out". */
  useEffect(() => {
    let alive = true;
    setSessionLostHandler(() => dispatch({ type: "SIGN_OUT" }));
    authApi.restoreSession()
      .then((session) => { if (alive && session) dispatch({ type: "SESSION_SET", user: session.user }); })
      .catch(() => {})
      .finally(() => { if (alive) setAuthReady(true); });
    return () => { alive = false; };
  }, []);

  /* Load categories + brands (small config lists, whole) and warm the product cache. Staff get inactive items and
     batch costs too — the server decides from the token; we always ask for everything and it filters by permission. */
  /* Every product this shop owns, whatever its status (pending_review, active, inactive, rejected, draft).
     Scoped by sellerId on the server, and paged so shops with more than 100 listings are complete. */
  const loadOwnListings = useCallback(async (sellerId) => {
    if (!sellerId) return;
    try {
      for (let page = 1; page <= 50; page++) {
        const res = await productsApi.list({ status: "any", sellerId, page, pageSize: 100 });
        if (res.items.length) dispatch({ type: "PRODUCTS_UPSERT", products: res.items });
        if (page * 100 >= res.total || !res.items.length) break;
      }
    } catch { /* transient — the next load retries */ }
  }, []);

  const loadCatalog = useCallback(async () => {
    try {
      setCatalogError(null);
      const [categories, brands, page] = await Promise.all([
        catalogApi.categories({ includeInactive: true }),
        catalogApi.brands({ includeInactive: true }),
        productsApi.list({ status: "any", sort: "bestselling", pageSize: CATALOG_PRELOAD }),
      ]);
      hydrateRegistries({ categories, brands });
      dispatch({ type: "CATALOG_LOADED", categories, products: page.items, total: page.total });
      setCatalogReady(true);
    } catch (err) {
      setCatalogError(err.message || "Couldn't load the catalogue");
    }
  }, []);

  const signedInUuid = state.session.user.uuid || null;
  useEffect(() => { if (authReady) loadCatalog(); }, [authReady, signedInUuid, loadCatalog]); // reload when the identity changes

  /* Catalogue writes go to the API first; the cache is updated from the server's response (never from what the
     form submitted), so ids, slugs, versions and validation errors are always the server's. */
  const catalog = useMemo(() => {
    const refreshCategories = async () => {
      const categories = await catalogApi.categories({ includeInactive: true });
      hydrateRegistries({ categories });
      dispatch({ type: "CATEGORIES_SET", categories });
    };
    const refreshBrands = async () => hydrateRegistries({ brands: await catalogApi.brands({ includeInactive: true }) });
    return {
      reload: async () => { await loadCatalog(); await loadOwnListings(state.session.shopOwnerSellerId); },
      reloadOwnListings: () => loadOwnListings(state.session.shopOwnerSellerId),
      loadShopListings: (sellerId) => loadOwnListings(sellerId), // staff opening a shop: pull that shop's full list, whatever the preload cap
      cacheProducts: (items) => { if (items?.length) dispatch({ type: "PRODUCTS_UPSERT", products: items }); },
      async createProduct(product, opts) {
        const { images, ...apiOpts } = opts || {};
        let saved = await productsApi.create(product, Object.keys(apiOpts).length ? apiOpts : undefined);
        // Photos go through their own endpoint (they're too big for the product JSON). The product already exists by now,
        // so a photo failure is reported but doesn't lose the listing.
        if (images?.length) {
          try { saved = await productsApi.setImages(saved.id, images); }
          catch (err) { dispatch({ type: "PRODUCTS_UPSERT", products: [saved] }); throw new Error(`Product saved, but its photos didn't upload: ${err.message || "try editing it again"}`); }
        }
        dispatch({ type: "PRODUCTS_UPSERT", products: [saved] });
        if (product.brandName) await refreshBrands();
        if (saved.sellerId) loadOwnListings(saved.sellerId); // background re-sync; the row is already in the list above
        return saved;
      },
      async updateProduct(product, { images } = {}) {
        let saved = await productsApi.update(product);
        if (images) {
          try { saved = await productsApi.setImages(saved.id, images); }
          catch (err) { dispatch({ type: "PRODUCTS_UPSERT", products: [saved] }); throw new Error(`Changes saved, but the photos didn't update: ${err.message || "try again"}`); }
        }
        dispatch({ type: "PRODUCTS_UPSERT", products: [saved] });
        return saved;
      },
      async removeProduct(id) { await productsApi.remove(id); dispatch({ type: "PRODUCT_REMOVE", id }); },
      async saveCategory(category, { isNew }) {
        const saved = isNew ? await catalogApi.createCategory(category) : await catalogApi.updateCategory(category);
        await refreshCategories();
        return saved;
      },
      async toggleCategory(id) { await catalogApi.toggleCategory(id); await refreshCategories(); },
    };
  }, [loadCatalog, loadOwnListings, state.session.shopOwnerSellerId]);

  /* Addresses, orders and wishlist are per-customer, so they only load once someone is signed in (guests get
     empty lists — cart pricing itself works without an account). Orders come back already scoped by the server:
     a plain customer sees their own, staff with orders:read_all see every order — no separate admin endpoint. */
  const isSignedIn = !!state.session.user.uuid;
  const loadCommerce = useCallback(async () => {
    if (!isSignedIn) {
      for (const a of [{ type: "ADDRESSES_LOADED", addresses: [] }, { type: "ORDERS_LOADED", orders: [] }, { type: "WISHLIST_SET", productIds: [] }, { type: "PRESCRIPTIONS_LOADED", prescriptions: [] }, { type: "SHOP_APPS_LOADED", applications: [] }, { type: "SELLER_PAYOUTS_LOADED", payouts: [] }]) dispatch(a);
      return;
    }
    // allSettled: a 403 on one staff-only call must never take the customer basics down with it.
    const [addresses, orders, wishlist, prescriptions, applications] = await Promise.allSettled([addressesApi.list(), ordersApi.list(), wishlistApi.list(), prescriptionsApi.listMine(), shopApplicationsApi.list()]);
    if (addresses.status === "fulfilled") dispatch({ type: "ADDRESSES_LOADED", addresses: addresses.value });
    if (orders.status === "fulfilled") dispatch({ type: "ORDERS_LOADED", orders: orders.value });
    if (wishlist.status === "fulfilled") dispatch({ type: "WISHLIST_SET", productIds: wishlist.value });
    // GET /prescriptions and GET /seller-applications each return "mine" or "everyone's" depending on the caller's permissions.
    if (prescriptions.status === "fulfilled") dispatch({ type: "PRESCRIPTIONS_LOADED", prescriptions: prescriptions.value });
    if (applications.status === "fulfilled") dispatch({ type: "SHOP_APPS_LOADED", applications: applications.value });
    else console.error("[vyra] couldn't load shop applications:", applications.reason?.code, applications.reason?.message);
  }, [isSignedIn]);

  /* Marketplace data that depends on who's signed in: staff see every seller and payout, a shop owner sees
     their own. Kept separate from loadCommerce because it needs the session's permissions/sellerId. */
  const loadMarketplace = useCallback(async (session) => {
    if (!session?.signedIn) return;
    const perms = session.permissions || [];
    if (perms.includes("sellers:read_all")) sellersApi.list().then((sellers) => dispatch({ type: "SELLERS_LOADED", sellers })).catch(() => {});
    else if (session.shopOwnerSellerId) sellersApi.mine().then((seller) => seller && dispatch({ type: "SELLERS_LOADED", sellers: [seller] })).catch(() => {});
    // The catalogue preload only ever returns public (active) products to a shop owner — their own pending,
    // inactive and rejected listings need an explicit, own-shop-scoped fetch.
    if (session.shopOwnerSellerId) loadOwnListings(session.shopOwnerSellerId); // always: the preload is capped at 100 products, so a shop's own listings can fall outside it
    if (perms.includes("payouts:read_all")) sellersApi.allPayouts().then((payouts) => dispatch({ type: "SELLER_PAYOUTS_LOADED", payouts })).catch(() => {});
    else if (session.shopOwnerSellerId) sellersApi.payouts(session.shopOwnerSellerId).then((payouts) => dispatch({ type: "SELLER_PAYOUTS_LOADED", payouts })).catch(() => {});
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!isSignedIn) { dispatch({ type: "NOTIFICATIONS_LOADED", notifications: [], unread: 0 }); return; }
    try {
      const { notifications, unread } = await notificationsApi.list({ limit: 30 });
      dispatch({ type: "NOTIFICATIONS_LOADED", notifications, unread });
    } catch { /* transient — next poll retries */ }
  }, [isSignedIn]);
  useEffect(() => { if (authReady) loadCommerce(); }, [authReady, signedInUuid, loadCommerce]);
  useEffect(() => {
    if (!authReady) return undefined;
    loadNotifications();
    if (!isSignedIn) return undefined;
    const t = setInterval(loadNotifications, 30_000);
    return () => clearInterval(t);
  }, [authReady, signedInUuid, isSignedIn, loadNotifications]);
  useEffect(() => { if (authReady) loadMarketplace(state.session); }, [authReady, signedInUuid, state.session.shopOwnerSellerId, loadMarketplace]); // eslint-disable-line react-hooks/exhaustive-deps

  const commerce = useMemo(() => ({
    reload: loadCommerce,
    async priceCart(lines, opts) { return cartApi.price(lines, opts); },
    async placeOrder(body) {
      const order = await ordersApi.create(body);
      dispatch({ type: "ORDER_UPSERT", order, clearCart: true });
      return order;
    },
    async advanceOrder(id, status, partner) {
      const order = await ordersApi.advance(id, status, partner);
      dispatch({ type: "ORDER_UPSERT", order });
      return order;
    },
    async cancelOrder(id, reason) {
      const order = await ordersApi.cancel(id, reason);
      dispatch({ type: "ORDER_UPSERT", order });
      return order;
    },
    /** Re-fetches only the order list (cheap) — used by screens that watch deliveries progress. */
    async reloadOrders() { const orders = await ordersApi.list(); dispatch({ type: "ORDERS_LOADED", orders }); return orders; },
    async refreshOrder(id) {
      const order = await ordersApi.get(id);
      dispatch({ type: "ORDER_UPSERT", order });
      return order;
    },
    async createAddress(a) { const address = await addressesApi.create(a); dispatch({ type: "ADDRESS_UPSERT", address }); return address; },
    async updateAddress(a) { const address = await addressesApi.update(a); dispatch({ type: "ADDRESS_UPSERT", address }); return address; },
    async setDefaultAddress(id) { const address = await addressesApi.setDefault(id); dispatch({ type: "ADDRESS_UPSERT", address }); return address; },
    async removeAddress(id) { await addressesApi.remove(id); dispatch({ type: "ADDRESS_REMOVE", id }); },
    async toggleWishlist(productId) { const res = await wishlistApi.toggle(productId); dispatch({ type: res.saved ? "WISHLIST_ADD_LOCAL" : "WISHLIST_REMOVE_LOCAL", productId }); return res; },
    async uploadPrescription(file, opts) { const prescription = await prescriptionsApi.upload(file, opts); dispatch({ type: "PRESCRIPTION_UPSERT", prescription }); return prescription; },
    async reviewPrescription(id, decision) { const prescription = await prescriptionsApi.review(id, decision); dispatch({ type: "PRESCRIPTION_UPSERT", prescription }); return prescription; },
    async fetchPrescriptionFile(id) { return prescriptionsApi.fetchFileBlobUrl(id); },
    async paymentsForOrder(orderId) { return paymentsApi.forOrder(orderId); },
    async requestRefund(orderId, body) { return paymentsApi.requestRefund(orderId, body); },
    async listRefunds(params) { return paymentsApi.listRefunds(params); },
    async decideRefund(id, decision) { return paymentsApi.decideRefund(id, decision); },

    /* Phase 6 — marketplace. Every one of these returns the server's answer and updates local state from it. */
    /* Re-fetches just the application list (admins get everyone's, applicants their own). The list is otherwise
       loaded once at sign-in, so an admin who is already signed in would never see a newly submitted application. */
    async refreshShopApplications() {
      const applications = await shopApplicationsApi.list();
      dispatch({ type: "SHOP_APPS_LOADED", applications });
      return applications;
    },
    async submitShopApplication(draft) {
      const application = await shopApplicationsApi.submit(draft);
      dispatch({ type: "SHOP_APP_SERVER_UPSERT", application, replacesId: draft.id });
      return application;
    },
    async resubmitShopApplication(app) {
      const application = await shopApplicationsApi.resubmit(app);
      dispatch({ type: "SHOP_APP_SERVER_UPSERT", application });
      return application;
    },
    async decideShopApplication(id, body) {
      const application = await shopApplicationsApi.decide(id, body);
      dispatch({ type: "SHOP_APP_SERVER_UPSERT", application });
      if (application.sellerId) sellersApi.list().then((sellers) => dispatch({ type: "SELLERS_LOADED", sellers })).catch(() => {});
      return application;
    },
    async verifyShopDocument(appId, docId, body) { const document = await shopApplicationsApi.verifyDocument(appId, docId, body); dispatch({ type: "SHOP_APP_DOC_VERIFY", appId, docId, status: document.verificationStatus, reason: document.rejectionReason }); return document; },
    async fetchShopDocument(appId, docId) { return shopApplicationsApi.fetchDocumentBlobUrl(appId, docId); },
    async setSellerStatus(id, status) { const seller = await sellersApi.setStatus(id, status); dispatch({ type: "SELLER_STATUS", id, status: seller.status }); return seller; },
    async sellerBalance(id) { return sellersApi.balance(id); },
    async requestPayout(sellerId, body) { const payout = await sellersApi.requestPayout(sellerId, body); dispatch({ type: "SELLER_PAYOUT_UPSERT", payout }); return payout; },
    async decidePayout(id, body) { const payout = await sellersApi.decidePayout(id, body); dispatch({ type: "SELLER_PAYOUT_UPSERT", payout }); return payout; },
  }), [loadCommerce]);

  const auth = useMemo(() => ({
    async login(credentials) { const { user } = await authApi.login(credentials); dispatch({ type: "SESSION_SET", user }); return user; },
    registerStart: authApi.registerStart,
    async registerVerify(payload) { const { user } = await authApi.registerVerify(payload); dispatch({ type: "SESSION_SET", user }); return user; },
    async logout() { try { await authApi.logout(); } finally { dispatch({ type: "SIGN_OUT" }); } },
  }), []);

  // Named `notify` (not `notifications`): the context value spreads `...state`, whose `notifications` is the ARRAY,
  // and a same-named key here would overwrite it with this object of methods.
  const notify = useMemo(() => ({
    reload: loadNotifications,
    async markRead(id) {
      const { unread } = await notificationsApi.read(id);
      dispatch({ type: "NOTIFICATION_READ", id, unread });
    },
    async markAllRead() {
      await notificationsApi.readAll();
      dispatch({ type: "NOTIFY_READ" });
    },
    getPreferences: () => notificationsApi.getPreferences(),
    setPreferences: (body) => notificationsApi.setPreferences(body),
  }), [loadNotifications]);

  const toast = useCallback((message, tone = "success") => {
    const id = `t${++toastSeq.current}`;
    dispatch({ type: "TOAST_ADD", toast: { id, message, tone } });
    setTimeout(() => dispatch({ type: "TOAST_REMOVE", id }), 2600);
  }, []);

  /* Cart lines are derived, never stored — prices stay correct if the
     catalogue changes underneath an open cart. */
  const cartLines = useMemo(() => buildLines(state.cart, state.products), [state.cart, state.products]);
  const savedLines = useMemo(() => buildLines(state.saved, state.products), [state.saved, state.products]);
  const cartCount = useMemo(() => state.cart.reduce((s, l) => s + l.qty, 0), [state.cart]);
  /* What customers actually see: live products only. A seller's new listing
     starts as "pending_review" and stays out of Home/Category/Search until
     an admin approves it — but it's still visible in the seller's own
     dashboard and to admins, via the full `products` list. */
  /* A customer only ever sees their own orders. `orders` (everything) is for
     staff, the delivery app and the seller dashboard. */
  // The server already scopes GET /orders: a plain customer only ever receives their own, so `myOrders` is just
  // `state.orders` for them. Staff with orders:read_all get every order there (for admin screens); they aren't
  // shoppers in this demo, so "my orders" is empty for them rather than misleadingly showing everyone's.
  const isOrdersStaff = state.session.user.permissions?.includes("orders:read_all");
  const myOrders = useMemo(() => (isOrdersStaff ? [] : state.orders), [state.orders, isOrdersStaff]);
  const activeProducts = useMemo(() => state.products.filter((p) => p.status === "active"), [state.products]);

  const value = useMemo(() => ({
    ...state,
    C: THEMES[state.themeKey],
    dispatch,
    auth,
    catalog,
    commerce,
    notify,
    unread: state.notificationsUnread,
    toast,
    cartLines,
    savedLines,
    cartCount,
    activeProducts,
    myOrders,
    isFirstOrder: myOrders.length === 0,
  }), [state, cartLines, savedLines, cartCount, activeProducts, myOrders, toast, auth, catalog, commerce, notify]);

  return (
    <AppCtx.Provider value={value}>
      {authReady && catalogReady ? children : (
        <div style={{ minHeight: "100vh", background: value.C.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} aria-busy={!catalogError}>
          {catalogError && (
            <div style={{ textAlign: "center", maxWidth: 320 }}>
              <p style={{ fontWeight: 800, color: value.C.navy }}>We couldn't load the store</p>
              <p style={{ fontSize: 13, marginTop: 6, color: value.C.muted }}>{catalogError}</p>
              <button onClick={loadCatalog} style={{ marginTop: 14, padding: "10px 22px", borderRadius: 999, fontWeight: 700, background: value.C.primary, color: "#fff" }}>Try again</button>
            </div>
          )}
        </div>
      )}
    </AppCtx.Provider>
  );
}

function buildLines(entries, products) {
  return entries.map((l) => {
    const product = productById(l.productId, products);
    if (!product) return null;
    const { price, mrp } = priceOf(product, l.variantId);
    const variant = l.variantId ? (product.variants || []).find((v) => v.id === l.variantId) : null;
    return { ...l, product, variant, unitPrice: price, mrp, lineTotal: Math.round(price * l.qty * 100) / 100 };
  }).filter(Boolean);
}
