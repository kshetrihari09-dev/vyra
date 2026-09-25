import React, { createContext, useContext, useEffect, useMemo, useReducer, useCallback, useRef, useState } from "react";
import { THEMES } from "../theme.js";
import { productById } from "../data/products.js";
import { STORES } from "../data/stores.js";
import { CARDS, SEED_NOTIFICATIONS, SEED_PRESCRIPTIONS } from "../data/seed.js";
import { SELLERS, SELLER_PAYOUTS_SEED } from "../data/sellers.js";
import { SEED_PURCHASE_ORDERS } from "../data/suppliers.js";
import { REGISTERED_MOBILES, REGISTERED_EMAILS } from "../data/customers.js";
import { SEED_SHOP_APPLICATIONS } from "../data/shopApplications.js";
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
  shopOwnerSellerId: null,
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
  registeredMobiles: [...REGISTERED_MOBILES],
  registeredEmails: [...REGISTERED_EMAILS],
  shopApplications: SEED_SHOP_APPLICATIONS,
  cart: [],
  saved: [],
  wishlist: [], // loaded from the API for signed-in customers (see loadCommerce)
  /* Catalogue: a CACHE of what the API returned (see loadCatalog). Empty until the first load completes. */
  categories: [],
  products: [],
  catalogVersion: 0,
  catalogTotal: 0,
  addresses: [], // loaded from the API once signed in (see loadCommerce)
  cards: CARDS,
  orders: [], // loaded from the API — customers see their own, staff with orders:read_all see everything
  prescriptions: SEED_PRESCRIPTIONS,
  notifications: SEED_NOTIFICATIONS,
  recentlyViewed: ["cold-brew-coffee", "cotton-tshirt", "paracetamol-500"],
  recentSearches: ["olive oil", "earbuds"],
  coupon: null,
  sellers: SELLERS,
  sellerPayouts: SELLER_PAYOUTS_SEED,
  currentSellerId: "novatech-official",
  purchaseOrders: SEED_PURCHASE_ORDERS,
  stockMovements: [],
  toasts: [],
  auditLog: [{ id: "a0", at: "2026-09-15T17:40:00", actor: "Owner", action: "Price updated", detail: "NovaBuds Pro → $96.75" }],
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

    case "RX_UPLOAD": return { ...state, prescriptions: [action.rx, ...state.prescriptions] };
    case "RX_DECIDE":
      return { ...state, prescriptions: state.prescriptions.map((r) => (r.id === action.id ? { ...r, status: action.status, notes: action.notes || r.notes, pharmacist: action.pharmacist || "Dr. N. Rao" } : r)) };

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
    case "SHOP_APP_SUBMIT": {
      const { application, actor } = action;
      const now = new Date().toISOString();
      const submitted = {
        ...application, status: "under_review", submittedAt: now, needsCorrection: false, rejectionReason: null,
        history: [...application.history, { status: "submitted", at: now, actor, note: "Submitted for review" }, { status: "under_review", at: now, actor: "System", note: "Queued for admin review" }],
      };
      const exists = state.shopApplications.some((a) => a.id === submitted.id);
      const shopApplications = exists
        ? state.shopApplications.map((a) => (a.id === submitted.id ? submitted : a))
        : [submitted, ...state.shopApplications];
      const registeredMobiles = state.registeredMobiles.includes(application.owner.mobile) ? state.registeredMobiles : [...state.registeredMobiles, application.owner.mobile];
      return { ...state, shopApplications, registeredMobiles };
    }
    /** Admin decisions. Approval mints a real Seller record — the shop then
        uses the exact same Seller Dashboard/Listings/Orders/Payouts screens
        every other marketplace seller uses, nothing parallel. */
    case "SHOP_APP_DECISION": {
      const { id, decision, reason, actor } = action; // decision: approve | reject | request_correction | suspend
      const app = state.shopApplications.find((a) => a.id === id);
      if (!app) return state;
      const now = new Date().toISOString();
      let sellers = state.sellers;
      let sellerId = app.sellerId;

      if (decision === "approve") {
        sellerId = `shop-${app.id.replace("app-", "")}`;
        sellers = [...state.sellers, {
          id: sellerId, name: app.shop.name, firstParty: false, status: "active",
          commissionRate: 12, rating: null, reviews: 0, joinedAt: now.slice(0, 10),
          payoutMethod: app.settlement.bankName ? `${app.settlement.bankName} •••• ${String(app.settlement.accountNumber).slice(-4)}` : "Not configured",
          contactEmail: app.shop.email || app.owner.email, brands: [],
        }];
      }
      if (decision === "suspend" && app.sellerId) {
        sellers = state.sellers.map((s) => (s.id === app.sellerId ? { ...s, status: "suspended" } : s));
      }

      const statusMap = { approve: "approved", reject: "rejected", request_correction: "rejected", suspend: "suspended" };
      const status = statusMap[decision];
      const updated = {
        ...app, status, sellerId, rejectionReason: decision === "approve" ? null : reason || app.rejectionReason,
        needsCorrection: decision === "request_correction",
        history: [...app.history, { status, at: now, actor, note: reason || (decision === "approve" ? "Application approved" : "") }],
      };
      const shopApplications = state.shopApplications.map((a) => (a.id === id ? updated : a));
      /* If the applicant happens to be the currently signed-in session, wire
         up their shop dashboard access immediately. */
      const session = decision === "approve" && state.session.user.phone === app.owner.mobile
        ? { ...state.session, shopOwnerSellerId: sellerId } : state.session;
      return { ...state, shopApplications, sellers, session };
    }
    /** A rejected owner edits and resubmits — same application id, status
        moves back into the review queue rather than starting over. */
    case "SHOP_APP_RESUBMIT": {
      const now = new Date().toISOString();
      const app = { ...action.application, status: "under_review", needsCorrection: false, rejectionReason: null,
        history: [...action.application.history, { status: "under_review", at: now, actor: action.actor, note: "Resubmitted after changes" }] };
      return { ...state, shopApplications: state.shopApplications.map((a) => (a.id === app.id ? app : a)) };
    }
    case "SHOP_APP_DOC_VERIFY": {
      const shopApplications = state.shopApplications.map((a) => {
        if (a.id !== action.appId) return a;
        return { ...a, documents: a.documents.map((d) => (d.id === action.docId ? { ...d, verificationStatus: action.status, rejectionReason: action.status === "rejected" ? action.reason : null } : d)) };
      });
      return { ...state, shopApplications };
    }

    case "NOTIFY_READ": return { ...state, notifications: state.notifications.map((n) => ({ ...n, unread: false })) };
    case "NOTIFY_ADD": return { ...state, notifications: [action.notification, ...state.notifications] };

    case "CATALOG_LOADED": return { ...state, categories: action.categories, products: action.products, catalogTotal: action.total, catalogVersion: state.catalogVersion + 1 };
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
    case "SELLER_PAYOUT": return { ...state, sellerPayouts: [action.payout, ...state.sellerPayouts] };

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
      reload: loadCatalog,
      cacheProducts: (items) => { if (items?.length) dispatch({ type: "PRODUCTS_UPSERT", products: items }); },
      async createProduct(product, opts) {
        const saved = await productsApi.create(product, opts);
        dispatch({ type: "PRODUCTS_UPSERT", products: [saved] });
        if (product.brandName) await refreshBrands();
        return saved;
      },
      async updateProduct(product) {
        const saved = await productsApi.update(product);
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
  }, [loadCatalog]);

  /* Addresses, orders and wishlist are per-customer, so they only load once someone is signed in (guests get
     empty lists — cart pricing itself works without an account). Orders come back already scoped by the server:
     a plain customer sees their own, staff with orders:read_all see every order — no separate admin endpoint. */
  const isSignedIn = !!state.session.user.uuid;
  const loadCommerce = useCallback(async () => {
    if (!isSignedIn) { dispatch({ type: "ADDRESSES_LOADED", addresses: [] }); dispatch({ type: "ORDERS_LOADED", orders: [] }); dispatch({ type: "WISHLIST_SET", productIds: [] }); return; }
    try {
      const [addresses, orders, wishlist] = await Promise.all([addressesApi.list(), ordersApi.list(), wishlistApi.list()]);
      dispatch({ type: "ADDRESSES_LOADED", addresses });
      dispatch({ type: "ORDERS_LOADED", orders });
      dispatch({ type: "WISHLIST_SET", productIds: wishlist });
    } catch { /* left as whatever was already cached; the page that needs it can retry */ }
  }, [isSignedIn]);

  useEffect(() => { if (authReady) loadCommerce(); }, [authReady, signedInUuid, loadCommerce]);

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
  }), [loadCommerce]);

  const auth = useMemo(() => ({
    async login(credentials) { const { user } = await authApi.login(credentials); dispatch({ type: "SESSION_SET", user }); return user; },
    registerStart: authApi.registerStart,
    async registerVerify(payload) { const { user } = await authApi.registerVerify(payload); dispatch({ type: "SESSION_SET", user }); return user; },
    async logout() { try { await authApi.logout(); } finally { dispatch({ type: "SIGN_OUT" }); } },
  }), []);

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
    toast,
    cartLines,
    savedLines,
    cartCount,
    activeProducts,
    myOrders,
    isFirstOrder: myOrders.length === 0,
  }), [state, cartLines, savedLines, cartCount, activeProducts, myOrders, toast, auth, catalog, commerce]);

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
