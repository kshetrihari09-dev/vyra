import { PRODUCTS } from "../data/products.js";
import { CATEGORIES, categoryPath, categoryTreeIds } from "../data/categories.js";
import { BRANDS, brandById } from "../data/brands.js";
import { priceOf } from "./pricing.js";
import { stockFor } from "./inventory.js";

const norm = (s) => String(s || "").toLowerCase().trim();

/**
 * TRUE PREFIX SEARCH — no `.includes()`, no fuzzy/typo matching. Typing "l"
 * must never surface "Paracetamol" just because it contains an "l" somewhere.
 * Every check below is a `startsWith`, applied only to fields worth searching
 * (barcode, SKU, name, brand) rather than every field on the product.
 *
 * Priority order (lower tier = ranked first):
 *   0  exact barcode match
 *   1  exact SKU match
 *   2  barcode starts with the query
 *   3  SKU starts with the query
 *   4  product name starts with the query
 *   5  a word inside the product name starts with the query ("cetirizine" matches "cold brew cetirizine kit")
 *   6  brand name starts with the query
 * Returns the tier number, or null if nothing matches at any tier.
 */
export function matchTier(product, term) {
  if (!term) return null;
  const barcode = norm(product.barcode);
  const sku = norm(product.sku);
  const name = norm(product.name);
  const brand = norm(brandById(product.brandId).name);

  if (barcode === term) return 0;
  if (sku === term) return 1;
  if (barcode.startsWith(term)) return 2;
  if (sku.startsWith(term)) return 3;
  if (name.startsWith(term)) return 4;
  if (name.split(/\s+/).some((w) => w.startsWith(term))) return 5;
  if (brand.startsWith(term)) return 6;
  return null;
}

/** Back-compat shim: some callers just want "does this match at all". */
export const scoreProduct = (product, term) => {
  const tier = matchTier(product, norm(term));
  return tier === null ? 0 : 100 - tier * 10;
};

export function searchProducts(query, products = PRODUCTS) {
  const term = norm(query);
  if (!term) return products;
  return products
    .map((p) => ({ p, tier: matchTier(p, term) }))
    .filter((x) => x.tier !== null)
    .sort((a, b) => a.tier - b.tier || b.p.sold - a.p.sold || b.p.rating - a.p.rating)
    .map((x) => x.p);
}

const MAX_SUGGESTIONS = 20;

/** Autocomplete — product prefix matches first, then brand/category prefix
    matches, capped at 20 and re-run on every keystroke by the caller. */
export function suggest(query, limit = MAX_SUGGESTIONS, products = PRODUCTS) {
  const term = norm(query);
  if (!term) return [];
  const out = [];
  const productHits = products
    .map((p) => ({ p, tier: matchTier(p, term) }))
    .filter((x) => x.tier !== null)
    .sort((a, b) => a.tier - b.tier || b.p.sold - a.p.sold)
    .map((x) => ({ type: "product", id: x.p.id, label: x.p.name, sub: brandById(x.p.brandId).name, tier: x.tier }));
  out.push(...productHits);
  if (out.length < limit) {
    CATEGORIES.forEach((c) => { if (c.status === "active" && norm(c.name).startsWith(term)) out.push({ type: "category", id: c.id, label: c.name, sub: c.parent ? "Subcategory" : "Category" }); });
  }
  if (out.length < limit) {
    BRANDS.forEach((b) => { if (norm(b.name).startsWith(term)) out.push({ type: "brand", id: b.id, label: b.name, sub: "Brand" }); });
  }
  return out.slice(0, limit);
}

export const findByBarcode = (code, products = PRODUCTS) =>
  products.find((p) => p.barcode === code || (p.variants || []).some((v) => v.barcode === code)) || null;
export const findBySku = (code, products = PRODUCTS) =>
  products.find((p) => p.sku === code || (p.variants || []).some((v) => v.sku === code)) || null;

/**
 * Single entry point for the POS / inventory unified "scan or search" box.
 * An exact barcode or SKU resolves straight to one product (skip the list);
 * anything else falls back to ranked prefix suggestions, capped at 20.
 */
export function searchCatalog(query, products = PRODUCTS, { limit = MAX_SUGGESTIONS } = {}) {
  const term = norm(query);
  if (!term) return { exact: null, results: [] };
  const exact = findByBarcode(query, products) || findBySku(query, products);
  const results = searchProducts(query, products).slice(0, limit);
  return { exact, results };
}


export const SORTS = [
  { id: "relevance", label: "Relevance" },
  { id: "price_asc", label: "Price: low to high" },
  { id: "price_desc", label: "Price: high to low" },
  { id: "rating", label: "Rating" },
  { id: "newest", label: "Newest" },
  { id: "bestselling", label: "Best selling" },
  { id: "discount", label: "Biggest discount" },
];

export function sortProducts(list, sortId) {
  const arr = [...list];
  const d = (p) => priceOf(p).discountPct;
  switch (sortId) {
    case "price_asc": return arr.sort((a, b) => priceOf(a).price - priceOf(b).price);
    case "price_desc": return arr.sort((a, b) => priceOf(b).price - priceOf(a).price);
    case "rating": return arr.sort((a, b) => b.rating - a.rating);
    case "newest": return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    case "bestselling": return arr.sort((a, b) => b.sold - a.sold);
    case "discount": return arr.sort((a, b) => d(b) - d(a));
    default: return arr;
  }
}

/**
 * Generic filter engine. `attrs` is a { key: value } map validated against
 * whatever schema the active category declares — no hardcoded fields.
 */
export function filterProducts(list, f, storeId) {
  return list.filter((p) => {
    if (f.categoryId) {
      const ids = categoryTreeIds(f.categoryId);
      if (!ids.includes(p.categoryId)) return false;
    }
    if (f.brands?.length && !f.brands.includes(p.brandId)) return false;
    const { price, discountPct } = priceOf(p);
    if (f.maxPrice != null && price > f.maxPrice) return false;
    if (f.minPrice != null && price < f.minPrice) return false;
    if (f.minRating && p.rating < f.minRating) return false;
    if (f.minDiscount && discountPct < f.minDiscount) return false;
    if (f.inStockOnly && stockFor(p, null, storeId) <= 0) return false;
    if (f.attrs) {
      for (const [k, v] of Object.entries(f.attrs)) {
        if (!v) continue;
        const value = p.attributes?.[k];
        const variantHit = (p.variants || []).some((va) => String(va.options?.[k]) === String(v));
        if (String(value) !== String(v) && !variantHit) return false;
      }
    }
    return true;
  });
}

/** Facets offered by the active category's own schema. */
export function facetsFor(category, products) {
  if (!category?.attributes) return [];
  return category.attributes
    .filter((a) => a.filterable)
    .map((a) => {
      const values = new Set();
      for (const p of products) {
        if (p.attributes?.[a.key]) values.add(String(p.attributes[a.key]));
        for (const v of p.variants || []) if (v.options?.[a.key]) values.add(String(v.options[a.key]));
      }
      return { ...a, values: [...values].filter((v) => v && v !== "—").sort() };
    })
    .filter((f) => f.values.length > 1);
}
