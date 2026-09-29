import { api } from "./client.js";

/** Phase 8. The inbox is per-user; the audit log needs audit:read (see AuditLog admin page). */
export const notificationsApi = {
  list: async ({ unread, limit, before } = {}) => api.get("/notifications", { unread, limit, before }),
  read: async (id) => api.post(`/notifications/${id}/read`),
  readAll: async () => api.post("/notifications/read-all"),
  getPreferences: async () => (await api.get("/notifications/preferences")).preferences,
  setPreferences: async (body) => (await api.put("/notifications/preferences", body)).preferences,
  auditLog: async (params = {}) => api.get("/audit-logs", params),
};
