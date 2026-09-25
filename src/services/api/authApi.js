import { api, refreshSession, setAccessToken } from "./client.js";

/** Auth endpoints. Every function returns plain data or throws ApiError (see client.js). */
export const authApi = {
  /** Step 1 of sign-up: validates and texts a code. → { challengeId, expiresInSeconds, devHint? } */
  registerStart: ({ name, mobile, email, password }) =>
    api.post("/auth/register/start", { name, mobile, ...(email ? { email } : {}), password }, { auth: false }),

  /** Step 2: verify the code; the account is created and signed in. → { user } */
  async registerVerify({ challengeId, code }) {
    const data = await api.post("/auth/register/verify", { challengeId, code }, { auth: false });
    setAccessToken(data.accessToken);
    return data;
  },

  /** identifier = mobile number or email. → { user } */
  async login({ identifier, password }) {
    const data = await api.post("/auth/login", { identifier, password }, { auth: false });
    setAccessToken(data.accessToken);
    return data;
  },

  /** On page load: trade the refresh cookie for a session. Resolves to { user } or null when signed out. */
  async restoreSession() {
    try {
      return await refreshSession();
    } catch (err) {
      if (err.status === 401 || err.code === "NO_REFRESH_TOKEN") return null;
      throw err;
    }
  },

  async logout() {
    try { await api.post("/auth/logout", {}, { auth: false }); } finally { setAccessToken(null); }
  },

  me: () => api.get("/auth/me"),
  forgotPassword: (identifier) => api.post("/auth/password/forgot", { identifier }, { auth: false }),
  resetPassword: ({ token, password }) => api.post("/auth/password/reset", { token, password }, { auth: false }),
  async changePassword({ currentPassword, newPassword }) {
    const data = await api.post("/auth/password/change", { currentPassword, newPassword });
    setAccessToken(data.accessToken);
    return data;
  },
};
