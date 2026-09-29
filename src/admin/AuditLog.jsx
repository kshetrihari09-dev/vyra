import React, { useCallback, useEffect, useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { EmptyState, InlineNotice, Badge } from "../components/shared/ui.jsx";
import { Shield, Search } from "../components/shared/Icon.jsx";
import { notificationsApi } from "../services/api/notificationsApi.js";
import { dateTimeLabel } from "../utils/format.js";

const KIND = { user: "info", order: "info", delivery: "info", rider: "info", seller_application: "warn", seller_payout: "ok", refund: "ok", prescription: "ok" };
const toneOf = (entityType) => KIND[entityType] || "neutral";

/** GET /api/audit-logs — needs `audit:read` (admin, or anyone else the role config grants it to). Values are
    redacted server-side (passwords, tokens, codes) before they ever reach this screen. */
export default function AuditLog() {
  const { session } = useApp();
  const C = useC();
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ entityType: "", action: "", actorUserId: "" });
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const pageSize = 25;

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const q = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const res = await notificationsApi.auditLog({ ...q, page: p, pageSize });
      setRows(res.entries); setTotal(res.total); setPage(p); setDenied(false);
    } catch (err) {
      if (err.status === 403) setDenied(true); else setRows([]);
    } finally { setLoading(false); }
  }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(1); }, [filters]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!session.permissions?.includes("audit:read") || denied) {
    return <EmptyState icon={Shield} title="Not available" message="Your account doesn't have permission to view the audit log." />;
  }

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const set = (k) => (e) => setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3">
      <InlineNotice tone="info" icon={Search}>Every record here was written in the same transaction as the change it describes — nothing is added after the fact. Sensitive values (passwords, tokens, codes) are always shown as [redacted].</InlineNotice>

      <div className="flex flex-wrap gap-2">
        <input value={filters.entityType} onChange={set("entityType")} placeholder="Entity type (order, user…)" className="px-3 py-2 rounded-xl text-xs flex-1 min-w-[140px]" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        <input value={filters.action} onChange={set("action")} placeholder="Action (exact, e.g. order.cancelled)" className="px-3 py-2 rounded-xl text-xs flex-1 min-w-[180px]" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
        <input value={filters.actorUserId} onChange={set("actorUserId")} placeholder="Actor user id" className="px-3 py-2 rounded-xl text-xs flex-1 min-w-[160px]" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        {loading ? (
          <p className="p-6 text-center text-sm" style={{ color: C.muted }}>Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-6 text-center text-sm" style={{ color: C.muted }}>No entries match these filters.</p>
        ) : rows.map((r, i) => (
          <div key={r.id} className="flex items-start gap-3 p-3.5" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
            <Badge tone={toneOf(r.entityType)}>{r.entityType || "—"}</Badge>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold" style={{ color: C.navy }}>{r.action}</p>
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{r.actor || "System"} · {dateTimeLabel(r.at)}{r.entityId ? ` · ${r.entityId}` : ""}{r.ip ? ` · ${r.ip}` : ""}</p>
              {(r.oldValue || r.newValue) && (
                <details className="mt-1.5">
                  <summary className="text-[11px] cursor-pointer" style={{ color: C.primary }}>Details</summary>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {r.oldValue && <pre className="text-[10px] rounded-lg p-2 overflow-x-auto" style={{ background: C.bg, color: C.muted }}>{JSON.stringify(r.oldValue, null, 2)}</pre>}
                    {r.newValue && <pre className="text-[10px] rounded-lg p-2 overflow-x-auto" style={{ background: C.bg, color: C.muted }}>{JSON.stringify(r.newValue, null, 2)}</pre>}
                  </div>
                </details>
              )}
            </div>
          </div>
        ))}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-between text-xs" style={{ color: C.muted }}>
          <button disabled={page <= 1} onClick={() => load(page - 1)} className="font-bold disabled:opacity-40" style={{ color: C.primary }}>Previous</button>
          <span>Page {page} of {pages} · {total} entries</span>
          <button disabled={page >= pages} onClick={() => load(page + 1)} className="font-bold disabled:opacity-40" style={{ color: C.primary }}>Next</button>
        </div>
      )}
    </div>
  );
}
