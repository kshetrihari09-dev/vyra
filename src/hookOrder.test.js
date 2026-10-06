import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";

/**
 * Guards against the "Rendered more hooks than during the previous render" crash: a React hook called AFTER an early
 * `return` at the top level of a component. It happens when a sheet/modal does `if (!thing) return null;` and a later line
 * adds a hook — it works until the moment `thing` appears, then the whole screen goes blank. (HandoverSheet had exactly this,
 * which broke "complete delivery".)
 *
 * Heuristic, deliberately simple: inside each top-level function, a component-level (2-space indented) early return must not
 * be followed by a component-level hook call. Handlers are indented deeper, so they are not flagged.
 */
const ROOTS = ["src/delivery", "src/tracking", "src/customer/pages", "src/seller/components", "src/seller/pages", "src/components/shared"];
const files = ROOTS.flatMap((dir) => readdirSync(dir).filter((f) => f.endsWith(".jsx")).map((f) => join(dir, f)));

export function findHooksAfterEarlyReturn(source) {
  const problems = [];
  const chunks = source.split(/^(?=(?:export default |export )?function \w+\()/m); // every top-level function, components and custom hooks alike
  for (const chunk of chunks) {
    const name = /function (\w+)\(/.exec(chunk)?.[1];
    if (!name) continue;
    const lines = chunk.split("\n");
    const ret = lines.findIndex((l) => /^ {2}if \(.*\) return\b/.test(l));
    if (ret < 0) continue;
    for (let i = ret + 1; i < lines.length; i++) {
      if (/^ {2}(?:const .* = )?use[A-Z]\w*\(/.test(lines[i])) problems.push(`${name}: "${lines[i].trim().slice(0, 60)}" is called after the early return on its line ${ret + 1}`);
    }
  }
  return problems;
}

describe("hook order", () => {
  it("the checker itself catches the original HandoverSheet mistake, and accepts the fixed shape", () => {
    const bad = "function Sheet({ d }) {\n  const [a] = useState(0);\n  if (!d) return null;\n  const inFlight = useRef(false);\n  return null;\n}\n";
    const good = "function Sheet({ d }) {\n  const [a] = useState(0);\n  const inFlight = useRef(false);\n  if (!d) return null;\n  return null;\n}\n";
    assert.equal(findHooksAfterEarlyReturn(bad).length, 1);
    assert.deepEqual(findHooksAfterEarlyReturn(good), []);
  });

  for (const file of files) {
    it(`${file} calls every hook before any early return`, () => {
      assert.deepEqual(findHooksAfterEarlyReturn(readFileSync(file, "utf8")), []);
    });
  }
});
