import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { setAccessToken } from "./client.js";
import { productsApi, searchApi, toProductPayload } from "./productsApi.js";
import { hydrateRegistries } from "../catalogRegistry.js";
import { BRANDS } from "../../data/brands.js";
import { CATEGORIES } from "../../data/categories.js";

function mockFetch(data) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, body: init.body });
    return { ok: true, status: 200, json: async () => ({ success: true, data }) };
  };
  return calls;
}

describe("toProductPayload", () => {
  const full = {
    id: "olive-oil-1l", name: "  Olive Oil ", slug: "olive-oil", categoryId: "grocery", brandId: "freshfields", price: "12.9", salePrice: 0, tax: 0, sku: " S-1 ", barcode: "",
    unit: "bottle", moq: 1, maxQty: 8, status: "active", tags: ["popular"], attributes: { weight: "1 L", origin: "", dietary: null },
    // server-owned — must never be sent
    rating: 4.6, reviews: 10, sold: 500, createdAt: "2026-01-01", stock: { "store-01": 31 }, batches: [{ batch: "X", qty: 1 }], sellerId: "novatech",
    version: 4,
  };
  it("drops server-owned fields (stock, batches, rating, sold, seller) and keeps the version for optimistic locking", () => {
    const p = toProductPayload(full);
    for (const k of ["stock", "batches", "rating", "reviews", "sold", "createdAt", "sellerId"]) assert.ok(!(k in p), k);
    assert.equal(p.version, 4);
  });
  it("normalises: trims, numbers, zero sale price → null, blank barcode → null, blank attributes removed", () => {
    const p = toProductPayload(full);
    assert.equal(p.name, "Olive Oil");
    assert.equal(p.sku, "S-1");
    assert.equal(p.price, 12.9);
    assert.equal(p.salePrice, null);
    assert.equal(p.barcode, null);
    assert.deepEqual(p.attributes, { weight: "1 L" });
  });
  it("variants keep pricing/sku but not their stock; an emptied variant list is sent as [] so the server can clear it", () => {
    const withV = toProductPayload({ ...full, variants: [{ id: "r1", label: "1 kg", options: { weight: "1 kg" }, price: 3.6, salePrice: 2.99, sku: "V1", stock: { "store-01": 40 } }] });
    assert.deepEqual(withV.variants, [{ id: "r1", label: "1 kg", options: { weight: "1 kg" }, price: 3.6, salePrice: 2.99, sku: "V1", barcode: null }]);
    assert.deepEqual(toProductPayload({ ...full, variants: [] }).variants, []);
    assert.equal(toProductPayload(full).variants, undefined);
  });
  it("a free-typed brand name is only sent when there is no brand id", () => {
    assert.equal(toProductPayload({ ...full, brandId: "", brandName: "Zenith" }).brandName, "Zenith");
    assert.equal(toProductPayload({ ...full, brandName: "Zenith" }).brandName, undefined);
  });
});

describe("catalogue endpoints", () => {
  beforeEach(() => setAccessToken(null));
  it("list serialises brand arrays, attr.<key> filters and pagination as query params", async () => {
    const calls = mockFetch({ items: [], total: 0, page: 1, pageSize: 12 });
    await productsApi.list({ category: "grocery", brand: ["a", "b"], "attr.dietary": "Veg", inStock: true, sort: "price_asc", page: 2, pageSize: 12, q: "para" });
    const url = new URL(calls[0].url, "http://x");
    assert.equal(url.pathname, "/api/products");
    assert.equal(url.searchParams.get("brand"), "a,b");
    assert.equal(url.searchParams.get("attr.dietary"), "Veg");
    assert.equal(url.searchParams.get("inStock"), "true");
    assert.equal(url.searchParams.get("page"), "2");
  });
  it("create sends opening stock separately from the product body; get/remove encode the id", async () => {
    let calls = mockFetch({ product: { id: "x" } });
    await productsApi.create({ name: "N", categoryId: "grocery", brandId: "b", price: 1, sku: "S" }, { openingStock: { "store-01": 5 } });
    assert.equal(JSON.parse(calls[0].body).openingStock["store-01"], 5);
    calls = mockFetch({ product: {} });
    await productsApi.get("a/b");
    assert.equal(calls[0].url, "/api/products/a%2Fb");
  });
  it("suggest and lookup hit the search endpoints and unwrap the payload", async () => {
    mockFetch({ suggestions: [{ type: "product", id: "p" }] });
    assert.deepEqual(await searchApi.suggest("pa"), [{ type: "product", id: "p" }]);
    const calls = mockFetch({ product: { id: "p" } });
    assert.deepEqual(await searchApi.lookup("890123"), { id: "p" });
    assert.match(calls[0].url, /\/api\/search\/lookup\?code=890123/);
  });
});

describe("registry hydration", () => {
  it("swaps categories and brands in place so modules holding the array reference see the API's data", () => {
    const catRef = CATEGORIES; const brandRef = BRANDS;
    hydrateRegistries({ categories: [{ id: "only", name: "Only", parent: null }], brands: [{ id: "b1", name: "B1" }] });
    assert.equal(CATEGORIES, catRef);
    assert.deepEqual(CATEGORIES.map((c) => c.id), ["only"]);
    assert.deepEqual(BRANDS.map((b) => b.id), ["b1"]);
    hydrateRegistries({ brands: [{ id: "b2", name: "B2" }] });
    assert.deepEqual(CATEGORIES.map((c) => c.id), ["only"], "an omitted list is left alone");
  });
});
