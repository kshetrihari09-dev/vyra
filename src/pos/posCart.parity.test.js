import test from "node:test";
import assert from "node:assert/strict";
import { previewTotals } from "./posCart.js";
import { priceSale } from "../../../backend/src/domain/posTotals.js"; // the server's real arithmetic

/* The screen's totals must equal the server's to the cent for ANY cart — otherwise the cashier would quote one price and the till charge another.
   Seeded PRNG so a failure is reproducible. */
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32); }

test("previewTotals === backend priceSale across 5,000 random carts and discounts", () => {
  const r = rng(20260101);
  let compared = 0; let refused = 0;
  for (let n = 0; n < 5000; n++) {
    const cart = Array.from({ length: 1 + Math.floor(r() * 6) }, () => ({
      unitPrice: Math.round(r() * 100000) / 100 || 0.01, qty: 1 + Math.floor(r() * 25), taxPercent: [0, 0, 5, 13, 18, 7.5][Math.floor(r() * 6)],
    }));
    const pick = r();
    const discount = pick < 0.3 ? null
      : pick < 0.65 ? { type: "percent", value: Math.round(r() * 10000) / 100 || 1 }
      : { type: "fixed", value: Math.round(r() * 200000) / 100 || 1 };
    const screen = previewTotals(cart, discount);
    let server; try { server = priceSale(cart, discount); } catch { refused++; assert.ok(screen.error, `server refused the discount but the screen accepted it: ${JSON.stringify({ cart, discount })}`); continue; }
    assert.ok(!screen.error, `screen refused a discount the server accepts: ${JSON.stringify({ cart, discount })}`);
    assert.deepEqual([screen.subtotal, screen.discount, screen.tax, screen.total], [server.subtotal, server.discount, server.tax, server.total], JSON.stringify({ cart, discount }));
    compared++;
  }
  assert.ok(compared > 3000 && refused > 10, `compared ${compared}, refused ${refused}`);
});
