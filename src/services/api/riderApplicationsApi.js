import { api, request } from "./client.js";

export const riderApplicationsApi = {
  mine: async () => (await api.get("/rider-applications")).applications,
  /** Reviewers only (delivery:manage + roles:assign) — the server decides. */
  all: async (status) => (await api.get("/rider-applications", { scope: "all", status })).applications,
  get: async (id) => (await api.get(`/rider-applications/${id}`)).application,
  submit: async (body) => (await api.post("/rider-applications", body)).application,
  resubmit: async (id, body) => (await api.post(`/rider-applications/${id}/resubmit`, body)).application,
  decide: async (id, decision, reason) => (await api.post(`/rider-applications/${id}/decide`, { decision, reason: reason || undefined })).application,
  /** Files sit in private storage behind the bearer-authenticated route, so they're fetched and opened as a blob: URL. The caller revokes it. */
  async documentBlobUrl(appId, docId) {
    const res = await request(`/rider-applications/${appId}/documents/${docId}/file`, { raw: true });
    return URL.createObjectURL(await res.blob());
  },
};
