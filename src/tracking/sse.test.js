import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSseParser } from "./sse.js";

const collect = () => { const out = []; return { out, parse: createSseParser((event, data) => out.push([event, data])) }; };

describe("SSE parser", () => {
  it("parses an event and ignores heartbeat comments", () => {
    const { out, parse } = collect();
    parse(': ping\n\nevent: tracking\ndata: {"a":1}\n\n');
    assert.deepEqual(out, [["tracking", { a: 1 }]]);
  });

  it("reassembles an event split across arbitrary chunks, byte by byte", () => {
    const { out, parse } = collect();
    const wire = 'event: tracking\ndata: {"stage":{"id":"on_the_way"},"n":2}\n\nevent: expired\ndata: {}\n\n';
    for (const ch of wire) parse(ch);
    assert.deepEqual(out, [["tracking", { stage: { id: "on_the_way" }, n: 2 }], ["expired", {}]]);
  });

  it("tolerates CRLF, multi-line data and a missing space after the colon", () => {
    const { out, parse } = collect();
    parse('event: tracking\r\ndata:{"a":\r\ndata:1}\r\n\r\n');
    assert.deepEqual(out, [["tracking", { a: 1 }]]);
  });

  it("drops a malformed event instead of throwing into the stream loop, and keeps going", () => {
    const { out, parse } = collect();
    parse("event: tracking\ndata: {not json\n\nevent: tracking\ndata: {\"ok\":true}\n\n");
    assert.deepEqual(out, [["tracking", { ok: true }]]);
  });

  it("holds an incomplete event until its terminator arrives", () => {
    const { out, parse } = collect();
    parse('event: tracking\ndata: {"a":1}');
    assert.equal(out.length, 0);
    parse("\n\n");
    assert.equal(out.length, 1);
  });
});
