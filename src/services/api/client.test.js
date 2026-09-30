import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { ApiError, api, refreshSession, setAccessToken, setSessionLostHandler } from "./client.js";

/** Scripted fake fetch: each call consumes the next handler and records what was sent. */
function mockFetch(handlers) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url, method: init.method, headers: init.headers, body: init.body, credentials: init.credentials });
    const h = handlers.shift();
    if (!h) throw new Error(`unexpected fetch ${url}`);
    if (h instanceof Error) throw h;
    const { status = 200, body } = h;
    return { ok: status >= 200 && status < 300, status, json: async () => body };
  };
  return calls;
}
const ok = (data) => ({ status: 200, body: { success: true, data } });
const fail = (status, code, message = code, details) => ({ status, body: { success: false, code, message, details } });

describe("api client", () => {
  beforeEach(() => { setAccessToken(null); setSessionLostHandler(null); });

  it("sends the bearer token, JSON body, CSRF header and credentials; unwraps { data }", async () => {
    setAccessToken("tok");
    const calls = mockFetch([ok({ hello: "world" })]);
    assert.deepEqual(await api.post("/things", { a: 1 }), { hello: "world" });
    assert.equal(calls[0].url, "/api/things");
    assert.equal(calls[0].headers.Authorization, "Bearer tok");
    assert.equal(calls[0].headers["X-Vyra-Client"], "web");
    assert.equal(calls[0].credentials, "include");
    assert.equal(calls[0].body, JSON.stringify({ a: 1 }));
  });

  it("reports a 2xx HTML response (SPA fallback) as API_NOT_ROUTED, not a vague failure", async () => {
    globalThis.fetch = async () => ({ ok: true, status: 200, headers: { get: () => "text/html; charset=utf-8" }, json: async () => { throw new SyntaxError("Unexpected token <"); } });
    await assert.rejects(() => api.get("/seller-applications"), (e) => e instanceof ApiError && e.code === "API_NOT_ROUTED" && e.status === 200);
  });

  it("builds query strings and skips empty values", async () => {
    const calls = mockFetch([ok({})]);
    await api.get("/products", { q: "para", page: 2, brand: "", cat: undefined });
    assert.equal(calls[0].url, "/api/products?q=para&page=2");
  });

  it("on 401 refreshes once and replays the original request with the new token", async () => {
    setAccessToken("old");
    const calls = mockFetch([fail(401, "INVALID_TOKEN"), ok({ accessToken: "new", user: {} }), ok({ items: [] })]);
    assert.deepEqual(await api.get("/orders"), { items: [] });
    assert.equal(calls[1].url, "/api/auth/refresh");
    assert.equal(calls[2].headers.Authorization, "Bearer new");
  });

  it("parallel 401s share ONE refresh call (single-flight)", async () => {
    setAccessToken("old");
    const calls = mockFetch([
      fail(401, "INVALID_TOKEN"), fail(401, "INVALID_TOKEN"), fail(401, "INVALID_TOKEN"),
      ok({ accessToken: "new", user: {} }), ok({ n: 1 }), ok({ n: 2 }), ok({ n: 3 }),
    ]);
    const res = await Promise.all([api.get("/a"), api.get("/b"), api.get("/c")]);
    assert.equal(res.length, 3);
    assert.equal(calls.filter((c) => c.url === "/api/auth/refresh").length, 1);
  });

  it("if the refresh fails, the session-lost handler fires and the original error is thrown", async () => {
    let lost = 0;
    setSessionLostHandler(() => { lost++; });
    setAccessToken("old");
    mockFetch([fail(401, "INVALID_TOKEN"), fail(401, "INVALID_REFRESH_TOKEN")]);
    await assert.rejects(api.get("/orders"), { code: "INVALID_TOKEN" });
    assert.equal(lost, 1);
  });

  it("does not try to refresh for non-auth 401s (e.g. wrong password) or other statuses", async () => {
    const calls = mockFetch([fail(401, "INVALID_CREDENTIALS", "Incorrect mobile/email or password")]);
    await assert.rejects(api.post("/auth/login", { identifier: "x", password: "y" }, { auth: false }), { code: "INVALID_CREDENTIALS" });
    assert.equal(calls.length, 1);
    mockFetch([fail(403, "FORBIDDEN")]);
    await assert.rejects(api.get("/admin/users"), { status: 403 });
  });

  it("retries once when another tab rotated the refresh cookie first", async () => {
    const calls = mockFetch([fail(401, "REFRESH_TOKEN_ROTATED"), ok({ accessToken: "fresh", user: { id: 1 } })]);
    const data = await refreshSession();
    assert.equal(data.accessToken, "fresh");
    assert.equal(calls.length, 2);
  });

  it("maps validation details to the { field: message } shape the forms use", async () => {
    mockFetch([fail(400, "VALIDATION_ERROR", "bad", [{ path: "body.mobile", message: "Enter a valid mobile number" }, { path: "body.password", message: "too short" }])]);
    const err = await api.post("/auth/register/start", {}, { auth: false }).catch((e) => e);
    assert.ok(err instanceof ApiError);
    assert.deepEqual(err.fieldErrors, { mobile: "Enter a valid mobile number", password: "too short" });
  });

  it("network failure becomes a friendly ApiError, not a raw TypeError", async () => {
    mockFetch([new TypeError("Failed to fetch")]);
    await assert.rejects(api.get("/x"), { code: "NETWORK_ERROR", status: 0 });
  });
});
