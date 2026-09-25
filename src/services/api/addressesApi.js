import { api } from "./client.js";

const payload = (a) => ({
  label: a.label || "Address", name: a.name, phone: a.phone, line1: a.line1, line2: a.line2 || null, city: a.city || null, zip: a.zip || null,
  provinceId: a.provinceId || null, districtId: a.districtId || null, municipalityId: a.municipalityId || null, ward: a.ward || null,
  instructions: a.instructions || null, isDefault: !!a.isDefault,
});

export const addressesApi = {
  list: async () => (await api.get("/addresses")).addresses,
  create: async (a) => (await api.post("/addresses", payload(a))).address,
  update: async (a) => (await api.put(`/addresses/${a.id}`, payload(a))).address,
  setDefault: async (id) => (await api.post(`/addresses/${id}/default`, {})).address,
  remove: (id) => api.delete(`/addresses/${id}`),
};
