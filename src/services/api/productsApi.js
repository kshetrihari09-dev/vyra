import { api, productImageKey } from "./client.js";

/** Only send what the server accepts; server-owned fields (stock, rating, sold, batches, createdAt) are never sent. */
export function toProductPayload(p) {
  const zeroToNull = (n) => (n === 0 || n === "" || n === undefined ? null : Number(n));
  const body = {
    ...(p.id ? { id: p.id } : {}),
    name: String(p.name ?? "").trim(),
    slug: p.slug || undefined,
    categoryId: p.categoryId,
    brandId: p.brandId || undefined,
    brandName: p.brandId ? undefined : p.brandName || undefined,
    description: p.description ?? "",
    price: Number(p.price) || 0,
    salePrice: zeroToNull(p.salePrice),
    tax: Number(p.tax) || 0,
    sku: String(p.sku ?? "").trim(),
    barcode: p.barcode ? String(p.barcode).trim() : null,
    unit: p.unit || "piece",
    moq: Number(p.moq) || 1,
    maxQty: Number(p.maxQty) || 10,
    status: p.status || "active",
    deliveryAvailable: p.deliveryAvailable !== false,
    tags: p.tags || [],
    art: p.art || null,
    attributes: Object.fromEntries(Object.entries(p.attributes || {}).filter(([, v]) => v !== "" && v != null).map(([k, v]) => [k, String(v)])),
    composition: p.composition || null,
    usage: p.usage || null,
    sideEffects: p.sideEffects || null,
    flags: p.flags?.prescriptionRequired ? { prescriptionRequired: true } : null,
    ...(p.version ? { version: p.version } : {}),
  };
  if (p.variants?.length) {
    body.variants = p.variants.map((v) => ({
      id: v.id, label: v.label, options: v.options || {}, price: Number(v.price) || 0, salePrice: zeroToNull(v.salePrice), sku: v.sku, barcode: v.barcode || null,
    }));
  } else if (p.variants) body.variants = [];
  return body;
}

/** Product catalogue endpoints. Every list call is paginated server-side (max 100 per page). */
export const productsApi = {
  /** → { items, page, pageSize, total }. `params` may include attr.<key> filters and brand as an array. */
  list: (params = {}) => {
    const { brand, ids, ...rest } = params;
    return api.get("/products", { ...rest, ...(brand?.length ? { brand: [].concat(brand).join(",") } : {}), ...(ids?.length ? { ids: ids.join(",") } : {}) });
  },
  get: async (id) => (await api.get(`/products/${encodeURIComponent(id)}`)).product,
  facets: (params = {}) => api.get("/products/facets", params),
  /** Create (opening stock is optional and needs the inventory:adjust permission). */
  create: async (product, { openingStock } = {}) =>
    (await api.post("/products", { ...toProductPayload(product), ...(openingStock ? { openingStock } : {}) })).product,
  update: async (product) => (await api.put(`/products/${encodeURIComponent(product.id)}`, toProductPayload(product))).product,
  /** Replaces the photo list. Entries: a new upload (data URL) or an existing photo (its URL or storage key). */
  setImages: async (id, images) => (await api.put(`/products/${encodeURIComponent(id)}/images`, {
    images: images.map((i) => (i.startsWith("data:") ? i : productImageKey(i) || i)),
  })).product,
  remove: (id) => api.delete(`/products/${encodeURIComponent(id)}`),
};

export const searchApi = {
  suggest: async (q, limit = 20) => (await api.get("/search/suggest", { q, limit })).suggestions,
  lookup: async (code) => (await api.get("/search/lookup", { code })).product,
};
