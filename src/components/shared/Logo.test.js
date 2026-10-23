import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

/** The wordmark is built from pieces (a plain-text search for the brand name misses it), so guard it explicitly. */
describe("brand wordmark", () => {
  const logo = readFileSync(new URL("./Logo.jsx", import.meta.url), "utf8");
  it("spells Vaspoor and no longer the old name", () => {
    assert.match(logo, /Vas<span[^>]*>poor<\/span>/);
    assert.equal(/Vy<span|>Vyra|Vyra/.test(logo), false);
  });
  it("the page title and tab icon carry the new name", () => {
    const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
    assert.match(html, /<title>Vaspoor<\/title>/); assert.match(html, /favicon\.svg/);
    assert.match(readFileSync(new URL("../../../public/favicon.svg", import.meta.url), "utf8"), /aria-label="Vaspoor"/);
  });
});
