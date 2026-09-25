import React, { useRef, useState } from "react";
import { useS } from "./tokens.js";
import { useWidth } from "./kit.jsx";

const nice = (max) => {
  if (max <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(max)));
  const n = max / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/** Revenue-style trend. type "area" for continuous money, "bar" for counts. Drawn at real pixel width so text stays legible on phones. */
export function TrendChart({ data, type = "area", format = (v) => String(v), height = 220, ariaLabel = "Trend chart" }) {
  const s = useS();
  const ref = useRef(null);
  const width = useWidth(ref);
  const [hover, setHover] = useState(null);
  const pad = { l: 46, r: 10, t: 12, b: 26 };
  const w = Math.max(width, 260), h = height;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const top = nice(Math.max(...data.map((d) => d.value), 0));
  const x = (i) => pad.l + (type === "bar" ? (iw / data.length) * (i + 0.5) : data.length === 1 ? iw / 2 : (iw / (data.length - 1)) * i);
  const y = (v) => pad.t + ih - (v / top) * ih;
  const ticks = [0, 1, 2, 3, 4].map((i) => (top / 4) * i);
  const step = Math.max(Math.ceil(data.length / Math.max(Math.floor(iw / 70), 1)), 1);
  const line = data.map((d, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const bw = Math.min((iw / data.length) * 0.62, 28);

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0, dist = Infinity;
    data.forEach((_, i) => { const dd = Math.abs(x(i) - px); if (dd < dist) { dist = dd; best = i; } });
    setHover(best);
  };
  const hv = hover != null ? data[hover] : null;

  return (
    <div ref={ref} className="relative w-full">
      <svg width={w} height={h} role="img" aria-label={ariaLabel} onPointerMove={onMove} onPointerLeave={() => setHover(null)} style={{ display: "block", touchAction: "pan-y" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={w - pad.r} y1={y(t)} y2={y(t)} stroke={s.lineSoft} />
            <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill={s.faint}>{format(t)}</text>
          </g>
        ))}
        {type === "area" ? (
          <>
            <defs>
              <linearGradient id="trend-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.accent} stopOpacity="0.22" />
                <stop offset="100%" stopColor={s.accent} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#trend-fill)" />
            <path d={line} fill="none" stroke={s.accent} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            {hover != null && <circle cx={x(hover)} cy={y(hv.value)} r="4" fill="#fff" stroke={s.accent} strokeWidth="2" />}
          </>
        ) : data.map((d, i) => (
          <rect key={i} x={x(i) - bw / 2} y={y(d.value)} width={bw} height={Math.max(y(0) - y(d.value), d.value ? 2 : 0)} rx="3" fill={s.accent} opacity={hover == null || hover === i ? 1 : 0.45} />
        ))}
        {data.map((d, i) => (i % step === 0 ? <text key={i} x={x(i)} y={h - 8} textAnchor="middle" fontSize="11" fill={s.faint}>{d.label}</text> : null))}
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={y(0)} stroke={s.line} strokeDasharray="3 3" />}
      </svg>
      {hv && (
        <div className="absolute pointer-events-none px-2.5 py-1.5 text-xs whitespace-nowrap"
          style={{ left: Math.min(Math.max(x(hover) - 50, 0), w - 110), top: 0, background: s.side, color: "#fff", borderRadius: 6 }}>
          <span className="opacity-70">{hv.label}</span> <span className="font-semibold tnum">{format(hv.value)}</span>
        </div>
      )}
    </div>
  );
}

/** Ranked horizontal bars — top products, categories, payment methods. */
export function BarList({ items, empty = "Nothing to show yet." }) {
  const s = useS();
  const max = Math.max(...items.map((i) => i.value), 0) || 1;
  if (!items.length) return <p className="text-sm py-6 text-center" style={{ color: s.muted }}>{empty}</p>;
  return (
    <ul className="space-y-3">
      {items.map((it) => (
        <li key={it.key}>
          <div className="flex items-center justify-between gap-3 text-[13px] mb-1">
            <span className="min-w-0 truncate font-medium flex items-center gap-2" style={{ color: s.text }}>{it.lead}{it.label}</span>
            <span className="tnum shrink-0 font-semibold" style={{ color: s.text }}>{it.display}</span>
          </div>
          <div className="h-1.5 rounded-full" style={{ background: s.canvas }}>
            <div className="h-full rounded-full" style={{ width: `${Math.max((it.value / max) * 100, 2)}%`, background: s.accent }} />
          </div>
          {it.sub && <p className="text-[11px] mt-1" style={{ color: s.muted }}>{it.sub}</p>}
        </li>
      ))}
    </ul>
  );
}
