import React, { useCallback, useEffect, useState } from "react";
import { useS } from "../components/tokens.js";
import { EmptyBlock, Notice, PageHeader, Panel, Pill, Toggle, Pagination, Segmented } from "../components/kit.jsx";
import { callsApi } from "../../services/api/callsApi.js";
import { useCalls } from "../../calls/CallsProvider.jsx";
import { dateTimeLabel } from "../../utils/format.js";

const TONE_OF = { completed: "ok", missed: "danger", declined: "neutral", cancelled: "neutral", failed: "warn" };
const LABEL_OF = { completed: "Answered", missed: "Missed", declined: "Declined", cancelled: "Cancelled by customer", failed: "Failed" };
const dur = (s) => (s == null ? "—" : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`);

/** Vaspoor Call desk: whether this shop is reachable, and its OWN call history (the server decides the shop — nothing here names one). */
export default function Calls() {
  const s = useS();
  const calls = useCalls();
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const pageSize = 15;

  const load = useCallback(() => callsApi.history({ page, pageSize, missedOnly: filter === "missed" })
    .then((d) => { setData(d); setError(null); }).catch((e) => setError(e.message)), [page, filter]);
  useEffect(() => { load(); }, [load]);
  // Refresh when a call ends so the list stays current without a manual reload.
  const endedAt = calls?.ui?.phase === "ended" || (!calls?.ui && !calls?.incoming);
  useEffect(() => { if (endedAt) { const t = setTimeout(load, 800); return () => clearTimeout(t); } return undefined; }, [endedAt, load]);

  const d = calls?.desk;
  const reachable = d?.online && d?.live && calls?.accepting;
  return (
    <div>
      <PageHeader title="Vaspoor Calls" description="Voice calls from customers over the internet. Keep this dashboard open to receive them." />
      <Panel title="Availability" className="mb-5">
        <div className="flex items-center gap-2 mb-1">
          <Pill tone={reachable ? "ok" : "neutral"}>{reachable ? "Customers can call you" : !calls?.accepting ? "Calls paused" : d?.error ? "Not reachable" : "Connecting…"}</Pill>
        </div>
        <Toggle on={!!calls?.accepting} onChange={(v) => calls.setAccepting(v)} label="Accept calls" hint="Turn off to stop customers ringing you without closing the dashboard." />
        {d?.error && <Notice tone="warn">{d.error}</Notice>}
        <p className="text-xs mt-3" style={{ color: s.muted }}>
          You're shown as online only while this dashboard is open and connected. Closing it takes your shop offline within a minute. Incoming calls ring in your browser — there is no background ringing on a locked or closed phone browser.
        </p>
      </Panel>

      <Panel title="Call history" padded={false}
        actions={<Segmented label="Filter" value={filter} onChange={(v) => { setFilter(v); setPage(1); }} options={[{ id: "all", label: "All" }, { id: "missed", label: "Missed" }]} />}>
        {error && <div className="p-4"><Notice tone="danger">{error}</Notice></div>}
        {!data && !error && <p className="p-4 text-sm" style={{ color: s.muted }}>Loading…</p>}
        {data && data.calls.length === 0 && <EmptyBlock icon="Phone" title={filter === "missed" ? "No missed calls" : "No calls yet"} message="Customer calls to your shop will appear here." />}
        {data && data.calls.length > 0 && (
          <ul>
            {data.calls.map((c) => (
              <li key={c.id} className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: `1px solid ${s.lineSoft}` }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: s.text }}>{c.customerName}</p>
                  <p className="text-xs" style={{ color: s.muted }}>{dateTimeLabel(c.createdAt)}{c.status === "completed" ? ` · ${dur(c.durationSeconds)}` : ""}</p>
                </div>
                <Pill tone={TONE_OF[c.status] || "neutral"}>{LABEL_OF[c.status] || c.status}</Pill>
              </li>
            ))}
          </ul>
        )}
        {data && data.total > pageSize && <div className="p-3"><Pagination page={page} pageSize={pageSize} total={data.total} onPage={setPage} /></div>}
      </Panel>
    </div>
  );
}
