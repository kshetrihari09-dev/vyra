import { api } from "./client.js";

const categoryPayload = (c) => ({
  ...(c.id ? { id: c.id } : {}),
  name: String(c.name ?? "").trim(),
  slug: c.slug || undefined,
  parent: c.parent || null,
  description: c.description || null,
  icon: c.icon || null,
  image: c.image || null,
  tint: c.tint || null,
  fg: c.fg || null,
  order: Number.isInteger(c.order) ? c.order : undefined,
  status: c.status || "active",
  unitLabel: c.unitLabel || null,
  attributes: c.attributes ? c.attributes.map((a) => ({ key: a.key, label: a.label, type: a.type || "text", options: a.type === "select" ? a.options : null, filterable: !!a.filterable, highlight: !!a.highlight })) : null,
  modules: c.modules?.length ? c.modules : null,
});

/** Categories and brands — small configuration lists, loaded whole. */
export const catalogApi = {
  categories: async ({ includeInactive = false } = {}) => (await api.get("/categories", { includeInactive: includeInactive || undefined })).categories,
  createCategory: async (c) => (await api.post("/categories", categoryPayload(c))).category,
  updateCategory: async (c) => (await api.put(`/categories/${encodeURIComponent(c.id)}`, categoryPayload(c))).category,
  toggleCategory: async (id) => (await api.post(`/categories/${encodeURIComponent(id)}/toggle`, {})).category,

  brands: async ({ includeInactive = false } = {}) => (await api.get("/brands", { includeInactive: includeInactive || undefined })).brands,
  createBrand: async (b) => (await api.post("/brands", b)).brand,
};
