import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeMapError, hasWebGL, tokenProblem } from "./mapErrors.js";

describe("tokenProblem", () => {
  it("accepts a public token", () => assert.equal(tokenProblem("pk.eyJ1IjoiYSJ9.abc"), null));
  it("explains a missing token, with the fix for the site owner in the detail only", () => {
    const p = tokenProblem("");
    assert.match(p.message, /Use my current location/); assert.match(p.detail, /VITE_MAPBOX_TOKEN/); assert.match(p.detail, /REDEPLOY/);
    assert.equal(/VITE_|Vercel/.test(p.message), false, "customers aren't shown config jargon");
    assert.equal(tokenProblem("   ").detail.includes("not set"), true);
  });
  it("catches a secret token in the browser, and a mistyped one", () => {
    assert.match(tokenProblem("sk.abc").detail, /SECRET/); assert.match(tokenProblem("abc123").detail, /pk\./);
    assert.match(tokenProblem('"pk.abc"').detail, /pk\./, "quotes pasted into the env var");
  });
});

describe("describeMapError", () => {
  it("401 = bad token, 403 = this website isn't allowed for the token", () => {
    assert.match(describeMapError({ status: 401 }).detail, /rejected the token/);
    assert.match(describeMapError({ status: 403 }).detail, /URL restrictions/);
    assert.match(describeMapError({ status: 429 }).detail, /rate limit/);
  });
  it("recognises WebGL and network failures", () => {
    assert.match(describeMapError(new Error("Failed to initialize WebGL")).message, /can't display the map/);
    assert.match(describeMapError(new Error("Failed to fetch")).message, /internet connection/);
  });
  it("ignores harmless errors (one missing tile) and empty input", () => {
    assert.equal(describeMapError({ status: 404, message: "Not Found" }), null); assert.equal(describeMapError(null), null);
  });
  it("hasWebGL reflects the context the browser can create", () => {
    const doc = (ok) => ({ createElement: () => ({ getContext: (k) => (ok && k === "webgl" ? {} : null) }) });
    assert.equal(hasWebGL(doc(true)), true); assert.equal(hasWebGL(doc(false)), false);
    assert.equal(hasWebGL({ createElement: () => { throw new Error("no dom"); } }), false);
  });
});
