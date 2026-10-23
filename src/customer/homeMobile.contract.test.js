import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { MOBILE_QUERY } from "../utils/useMediaQuery.js";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

/** Guards the phone home's contract with the rest of the app (the layout itself is verified in a real browser at 320–430 px). */
describe("mobile home contract", () => {
  it("phones are everything below Tailwind's md breakpoint (768 px); tablet and desktop keep the original home", () => {
    assert.equal(MOBILE_QUERY, "(max-width: 767.98px)");
    const home = read("./pages/Home.jsx");
    assert.match(home, /useIsMobile\(\)/); assert.match(home, /isMobile \? <MobileHome[^>]*\/> : <DesktopHome/);
  });
  it("uses real data and the shared product card — no hard-coded products or stats", () => {
    const m = read("./pages/HomeMobile.jsx").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, ""); // code only, not comments
    assert.match(m, /ProductCard[^\n]*variant="m"/);
    assert.equal(/price:\s*\d|stock:\s*\d|mock|dummy|lorem/i.test(m), false);
    assert.match(m, /priceOf\(p\)\.discountPct/, "the flash-deal discount is computed from the products shown");
  });
  it("carousels are contained: snap scrolling, no page-level horizontal overflow, a fixed card width, momentum scrolling", () => {
    const css = read("../index.css");
    assert.match(css, /\.mrail\s*{[^}]*--mcard-w:\s*clamp\(140px,\s*41vw,\s*172px\)/);
    assert.match(css, /\.mscroll\s*{[^}]*overscroll-behavior-x:\s*contain/);
    assert.match(css, /scroll-snap-type:\s*x proximity/); assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  });
  it("the bottom nav stays fixed and the page reserves more room than its height (nav ~58 px + safe area)", () => {
    const layout = read("./layout/CustomerLayout.jsx");
    assert.match(layout, /md:hidden fixed bottom-0 left-0 right-0/);
    assert.match(layout, /pb-\[max\(env\(safe-area-inset-bottom\),6px\)\]/);
    assert.match(read("../components/shared/Page.jsx"), /pb-28 md:pb-16/, "Page keeps 112 px of bottom padding on phones");
  });
  it("the desktop header lets its search box shrink so Cart/Account never overflow on narrow tablets", () => {
    assert.match(read("./layout/CustomerLayout.jsx"), /flex-1 max-w-2xl min-w-0/);
  });
});
