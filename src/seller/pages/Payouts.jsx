import React, { useMemo, useState } from "react";
import { useApp } from "../../store/AppContext.jsx";
import { useShop } from "../hooks/useShopData.js";
import { useS } from "../components/tokens.js";
import { Btn, ConfirmModal, DataTable, EmptyBlock, Metric, PageHeader, Panel } from "../components/kit.jsx";
import { salesSeries } from "../../services/sellerAnalytics.js";
import { dateTimeLabel, fmt } from "../../utils/format.js";

export default function Payouts() {
  const s = useS();
  const { seller, earnings, payouts, paidOut, available, rows } = useShop();
  const { dispatch, toast, commerce } = useApp();
  const [confirm, setConfirm] = useState(false);
  const canWrite = seller.status === "active";
  const rate = seller.commissionRate;

  const [busy, setBusy] = useState(false);
  const request = async () => {
    setBusy(true);
    try {
      // No amount sent: the server pays out its own view of the available balance (delivered orders, net of
      // commission, minus everything already requested) — never a figure computed in the browser.
      const payout = await commerce.requestPayout(seller.id, {});
      dispatch({ type: "AUDIT", entry: { actor: `${seller.name} (seller)`, action: "Payout requested", detail: fmt(payout.amount) } });
      toast(`Payout of ${fmt(payout.amount)} requested — awaiting approval`);
      setConfirm(false);
    } catch (err) {
      toast(err.message || "Couldn't request that payout", "danger");
    } finally {
      setBusy(false);
    }
  };

  const statement = useMemo(() => salesSeries(rows, "month", 6).filter((m) => m.revenue > 0).reverse().map((m) => ({ ...m, commission: Math.round(m.revenue * rate) / 100, net: Math.round(m.revenue * (100 - rate)) / 100 })), [rows, rate]);

  return (
    <div>
      <PageHeader title="Payouts" description="What you've earned after commission, and what has been paid to you." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <div className="lg:col-span-1 p-5 flex flex-col justify-between" style={{ background: s.side, borderRadius: s.rPanel }}>
          <div>
            <p className="text-xs" style={{ color: "rgba(255,255,255,.65)" }}>Available for payout</p>
            <p className="s-heading tnum text-[32px] font-semibold text-white mt-1">{fmt(available)}</p>
            <p className="text-xs mt-1" style={{ color: "rgba(255,255,255,.6)" }}>After {rate}% commission · paid via {seller.payoutMethod}</p>
          </div>
          <Btn className="mt-5 self-start" variant="primary" icon="Wallet" disabled={!canWrite || available <= 0} onClick={() => setConfirm(true)}>Request payout</Btn>
        </div>
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4 gap-3">
          <Metric label="Gross sales" icon="TrendingUp" value={fmt(earnings.gross)} hint={`${earnings.orderCount} orders`} />
          <Metric label="Commission" icon="Receipt" value={`−${fmt(earnings.commission)}`} hint={`${rate}% of sales`} />
          <Metric label="Net earnings" icon="Wallet" value={fmt(earnings.net)} hint="After commission" />
          <Metric label="Paid out" icon="CheckCircle2" value={fmt(paidOut)} hint={`${payouts.length} payout(s)`} />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Panel title="Payout history" padded={false}>
          <DataTable rowKey={(p) => p.id} rows={payouts} empty={<EmptyBlock icon="Wallet" title="No payouts yet" message="Requested payouts show up here." />} columns={[
            { key: "at", label: "Date", mobile: "title", render: (p) => dateTimeLabel(p.at) },
            { key: "method", label: "Method", render: (p) => <span style={{ color: s.muted }}>{p.method}</span> },
            { key: "amount", label: "Amount", align: "right", mobile: "aside", render: (p) => <span className="font-semibold">{fmt(p.amount)}</span> },
          ]} />
        </Panel>
        <Panel title="Monthly earnings statement" subtitle="Excludes cancelled and returned orders" padded={false}>
          <DataTable rowKey={(m) => m.label} rows={statement} empty={<EmptyBlock icon="Receipt" title="No earnings yet" />} columns={[
            { key: "label", label: "Month", mobile: "title", render: (m) => <span className="font-medium">{m.label}</span> },
            { key: "revenue", label: "Gross", align: "right", render: (m) => fmt(m.revenue) },
            { key: "commission", label: "Commission", align: "right", render: (m) => `−${fmt(m.commission)}` },
            { key: "net", label: "Net", align: "right", mobile: "aside", render: (m) => <span className="font-semibold">{fmt(m.net)}</span> },
          ]} />
        </Panel>
      </div>
      <ConfirmModal open={confirm} title="Request a payout?" confirmLabel={`Request ${fmt(available)}`} onClose={() => setConfirm(false)} onConfirm={request}
        message={`${fmt(available)} will be sent to your ${seller.payoutMethod} account.`} />
    </div>
  );
}
