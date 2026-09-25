import React, { useEffect, useRef, useState } from "react";
import { useS, TONES } from "./tokens.js";
import { Icon, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, X, Search, Package } from "../../components/shared/Icon.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { TONE } from "../../theme.js";

/* ---------------------------------- BUTTON ---------------------------------- */
export function Btn({ children, variant = "secondary", size = "md", icon, onClick, disabled, type = "button", className = "", title, full, ...rest }) {
  const s = useS();
  const sizes = { sm: "h-8 px-3 text-[13px]", md: "h-9 px-3.5 text-sm", lg: "h-10 px-4 text-sm" };
  const v = {
    primary: { background: disabled ? "#B9C4CB" : s.accent, color: "#fff", border: "1px solid transparent" },
    secondary: { background: s.panel, color: s.text, border: `1px solid ${s.line}` },
    ghost: { background: "transparent", color: s.muted, border: "1px solid transparent" },
    danger: { background: TONE.dangerBg, color: TONE.danger, border: "1px solid transparent" },
    dark: { background: s.side, color: "#fff", border: "1px solid transparent" },
  }[variant];
  return (
    <button type={type} title={title} onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap ${sizes[size]} ${full ? "w-full" : ""} ${disabled ? "opacity-60 cursor-not-allowed" : "hover:brightness-95 active:brightness-90"} ${className}`}
      style={{ ...v, borderRadius: s.r }} {...rest}>
      {icon && <Icon name={icon} size={15} />}
      {children}
    </button>
  );
}

export function IconBtn({ icon, label, onClick, badge, className = "", tone }) {
  const s = useS();
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick}
      className={`relative w-9 h-9 inline-flex items-center justify-center hover:bg-black/5 ${className}`}
      style={{ borderRadius: s.r, color: tone || s.muted }}>
      <Icon name={icon} size={18} />
      {badge > 0 && <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-semibold flex items-center justify-center" style={{ background: TONE.danger, color: "#fff" }}>{badge > 99 ? "99+" : badge}</span>}
    </button>
  );
}

/* ---------------------------------- LAYOUT ---------------------------------- */
export function PageHeader({ title, description, actions, back }) {
  const s = useS();
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        {back}
        <h1 className="s-heading text-xl md:text-2xl font-semibold leading-tight" style={{ color: s.text }}>{title}</h1>
        {description && <p className="text-sm mt-1" style={{ color: s.muted }}>{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ title, subtitle, actions, children, padded = true, className = "" }) {
  const s = useS();
  return (
    <section className={`min-w-0 ${className}`} style={{ background: s.panel, border: `1px solid ${s.line}`, borderRadius: s.rPanel }}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-4 py-3" style={{ borderBottom: `1px solid ${s.lineSoft}` }}>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold truncate" style={{ color: s.text }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: s.muted }}>{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Metric({ label, value, hint, delta, icon, onClick, tone }) {
  const s = useS();
  const Tag = onClick ? "button" : "div";
  const up = delta != null && delta >= 0;
  return (
    <Tag onClick={onClick} className={`text-left p-3.5 min-w-0 ${onClick ? "hover:bg-black/[.02]" : ""}`}
      style={{ background: s.panel, border: `1px solid ${s.line}`, borderRadius: s.rPanel }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate" style={{ color: s.muted }}>{label}</span>
        {icon && <Icon name={icon} size={15} style={{ color: tone || s.faint }} />}
      </div>
      <p className="s-heading tnum text-[22px] font-semibold mt-1.5 leading-none truncate" style={{ color: s.text }}>{value}</p>
      <p className="text-xs mt-2 flex items-center gap-1 truncate" style={{ color: s.muted }}>
        {delta != null && (
          <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color: up ? TONE.ok : TONE.danger }}>
            <Icon name={up ? "ArrowUpRight" : "ArrowDownRight"} size={12} />{Math.abs(delta)}%
          </span>
        )}
        <span className="truncate">{hint}</span>
      </p>
    </Tag>
  );
}

export function Pill({ tone = "neutral", children, dot = true }) {
  const t = TONES[tone] || TONES.neutral;
  return (
    <span className="inline-flex items-center gap-1.5 px-2 h-[22px] text-[12px] font-medium whitespace-nowrap" style={{ background: t.bg, color: t.fg, borderRadius: 6 }}>
      {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.fg }} />}
      {children}
    </span>
  );
}

export function EmptyBlock({ icon = "Package", title, message, action }) {
  const s = useS();
  return (
    <div className="text-center px-6 py-12">
      <span className="inline-flex w-11 h-11 items-center justify-center mb-3" style={{ background: s.canvas, borderRadius: s.rPanel }}>
        <Icon name={icon} size={20} style={{ color: s.faint }} />
      </span>
      <p className="text-sm font-semibold" style={{ color: s.text }}>{title}</p>
      {message && <p className="text-sm mt-1 max-w-sm mx-auto" style={{ color: s.muted }}>{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Notice({ tone = "info", children }) {
  const t = TONES[tone] || TONES.info;
  return <div className="text-sm px-3 py-2.5 leading-snug" style={{ background: t.bg, color: t.fg, borderRadius: 8 }}>{children}</div>;
}

export function KeyValue({ rows }) {
  const s = useS();
  return (
    <dl className="text-sm">
      {rows.filter(Boolean).map(([k, v], i) => (
        <div key={k} className="flex items-start justify-between gap-4 py-2" style={{ borderTop: i ? `1px solid ${s.lineSoft}` : "none" }}>
          <dt style={{ color: s.muted }}>{k}</dt>
          <dd className="text-right font-medium min-w-0 break-words" style={{ color: s.text }}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/* ---------------------------------- INPUTS ---------------------------------- */
export function Field({ label, hint, error, children, className = "" }) {
  const s = useS();
  return (
    <label className={`block ${className}`}>
      {label && <span className="block text-[13px] font-medium mb-1" style={{ color: s.text }}>{label}</span>}
      {children}
      {error ? <span className="block text-xs mt-1 font-medium" style={{ color: TONE.danger }}>{error}</span>
        : hint ? <span className="block text-xs mt-1" style={{ color: s.muted }}>{hint}</span> : null}
    </label>
  );
}

const inputStyle = (s, error) => ({ background: "#fff", border: `1px solid ${error ? TONE.danger : s.line}`, borderRadius: s.r, color: s.text });

export function Input({ prefix, suffix, error, className = "", ...props }) {
  const s = useS();
  return (
    <div className={`flex items-center h-9 ${className}`} style={inputStyle(s, error)}>
      {prefix && <span className="pl-2.5 text-sm" style={{ color: s.muted }}>{prefix}</span>}
      <input {...props} className="flex-1 min-w-0 h-full px-2.5 text-sm bg-transparent outline-none tnum" />
      {suffix && <span className="pr-2.5 text-sm" style={{ color: s.muted }}>{suffix}</span>}
    </div>
  );
}

export function NumberInput({ value, onChange, min = 0, step = 1, ...props }) {
  return <Input type="number" inputMode="decimal" min={min} step={step} value={Number.isFinite(value) ? value : ""}
    onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))} {...props} />;
}

export function Select({ children, error, className = "", ...props }) {
  const s = useS();
  return (
    <select {...props} className={`h-9 w-full px-2.5 text-sm outline-none ${className}`} style={inputStyle(s, error)}>{children}</select>
  );
}

export function Textarea({ error, ...props }) {
  const s = useS();
  return <textarea {...props} className="w-full px-2.5 py-2 text-sm outline-none resize-y" style={inputStyle(s, error)} />;
}

export function Toggle({ on, onChange, label, hint }) {
  const s = useS();
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium" style={{ color: s.text }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: s.muted }}>{hint}</p>}
      </div>
      <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
        className="relative shrink-0 w-10 h-[22px] rounded-full transition-colors" style={{ background: on ? s.accent : "#C5CED4" }}>
        <span className="absolute top-[3px] w-4 h-4 rounded-full bg-white transition-all" style={{ left: on ? 21 : 3 }} />
      </button>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = "Search", className = "" }) {
  const s = useS();
  return (
    <div className={`flex items-center gap-2 h-9 px-2.5 ${className}`} style={inputStyle(s)}>
      <Search size={15} style={{ color: s.faint }} />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={placeholder}
        className="flex-1 min-w-0 text-sm bg-transparent outline-none" />
      {value && <button type="button" aria-label="Clear search" onClick={() => onChange("")}><X size={14} style={{ color: s.faint }} /></button>}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  const s = useS();
  return (
    <div role="tablist" className="flex gap-1 overflow-x-auto no-scrollbar" style={{ borderBottom: `1px solid ${s.line}` }}>
      {items.map((t) => {
        const on = t.id === value;
        return (
          <button key={t.id} role="tab" aria-selected={on} onClick={() => onChange(t.id)}
            className="shrink-0 px-3 h-10 text-sm font-medium inline-flex items-center gap-1.5 -mb-px"
            style={{ color: on ? s.text : s.muted, borderBottom: `2px solid ${on ? s.accent : "transparent"}` }}>
            {t.label}
            {t.count != null && <span className="tnum text-xs px-1.5 rounded" style={{ background: on ? s.accentSoft : s.canvas, color: on ? s.accent : s.muted }}>{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({ options, value, onChange, label }) {
  const s = useS();
  return (
    <div role="group" aria-label={label} className="inline-flex p-0.5" style={{ background: s.canvas, borderRadius: s.r }}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={o.id === value} onClick={() => onChange(o.id)}
          className="px-3 h-8 text-[13px] font-medium" style={{ borderRadius: 6, background: o.id === value ? "#fff" : "transparent", color: o.id === value ? s.text : s.muted, boxShadow: o.id === value ? "0 0 0 1px " + s.line : "none" }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* --------------------------------- OVERLAYS --------------------------------- */
function useLock(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
}

/** Side panel on desktop, full screen on phones. Used for editing records. */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 560 }) {
  const s = useS();
  useLock(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(16,32,42,.45)" }} onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full flex flex-col" style={{ maxWidth: width, background: s.panel, boxShadow: "-8px 0 30px rgba(16,32,42,.15)" }}>
        <header className="flex items-start justify-between gap-3 px-5 py-4 shrink-0" style={{ borderBottom: `1px solid ${s.line}`, paddingTop: "max(1rem, env(safe-area-inset-top))" }}>
          <div className="min-w-0">
            <h2 className="s-heading text-base font-semibold truncate" style={{ color: s.text }}>{title}</h2>
            {subtitle && <p className="text-xs mt-0.5" style={{ color: s.muted }}>{subtitle}</p>}
          </div>
          <IconBtn icon="X" label="Close" onClick={onClose} />
        </header>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <footer className="px-5 py-3 shrink-0 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${s.line}`, paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>{footer}</footer>}
      </div>
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, size = 440 }) {
  const s = useS();
  useLock(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0" style={{ background: "rgba(16,32,42,.45)" }} onClick={onClose} />
      <div className="relative w-full max-h-[90vh] flex flex-col" style={{ maxWidth: size, background: s.panel, borderRadius: 12, boxShadow: "0 20px 50px rgba(16,32,42,.25)" }}>
        <header className="flex items-center justify-between gap-3 px-5 py-3.5 shrink-0" style={{ borderBottom: `1px solid ${s.line}` }}>
          <h2 className="s-heading text-base font-semibold" style={{ color: s.text }}>{title}</h2>
          <IconBtn icon="X" label="Close" onClick={onClose} />
        </header>
        <div className="p-5 overflow-y-auto">{children}</div>
        {footer && <footer className="px-5 py-3 flex items-center justify-end gap-2" style={{ borderTop: `1px solid ${s.line}` }}>{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = "Confirm", danger, onConfirm, onClose }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size={420}
      footer={<><Btn onClick={onClose}>Cancel</Btn><Btn variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Btn></>}>
      <p className="text-sm leading-relaxed" style={{ color: "#4A5F6B" }}>{message}</p>
    </Modal>
  );
}

/* ------------------------------------ TABLE ------------------------------------ */
/* One column definition renders both ways: a real table from md up, and a stack
   of cards on phones so nothing scrolls sideways.
   column.mobile: "title" (card heading) | "aside" (top-right of card) | "footer" (card actions) | "hide" | default → label/value row */
export function DataTable({ columns, rows, rowKey, onRowClick, sort, onSort, empty }) {
  const s = useS();
  if (!rows.length) return empty || null;
  const title = columns.find((c) => c.mobile === "title") || columns[0];
  const aside = columns.find((c) => c.mobile === "aside");
  const footer = columns.find((c) => c.mobile === "footer");
  const meta = columns.filter((c) => !["title", "aside", "footer", "hide"].includes(c.mobile));
  return (
    <>
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}
                    className={`px-4 h-10 font-medium whitespace-nowrap ${c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left"}`}
                    style={{ color: s.muted, background: "#FAFBFC", borderBottom: `1px solid ${s.line}`, width: c.width }}>
                    {c.sortable && onSort ? (
                      <button type="button" onClick={() => onSort(c.key)} className="inline-flex items-center gap-1 font-medium hover:opacity-80">
                        {c.label}
                        <span style={{ opacity: active ? 1 : 0.35 }}>{active && sort.dir === "asc" ? <ChevronUp size={13} /> : <ChevronDown size={13} />}</span>
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                tabIndex={onRowClick ? 0 : undefined} onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(r); } : undefined}
                className={onRowClick ? "cursor-pointer hover:bg-black/[.02]" : ""}>
                {columns.map((c) => (
                  <td key={c.key} className={`px-4 py-3 align-middle ${c.align === "right" ? "text-right tnum" : c.align === "center" ? "text-center" : ""} ${c.className || ""}`}
                    style={{ borderBottom: `1px solid ${s.lineSoft}`, color: s.text }}>
                    {c.render ? c.render(r) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="md:hidden">
        {rows.map((r, i) => (
          <li key={rowKey(r)} className="p-3.5" style={{ borderTop: i ? `1px solid ${s.lineSoft}` : "none" }}>
            <div onClick={onRowClick ? () => onRowClick(r) : undefined} className={onRowClick ? "cursor-pointer" : ""}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 font-medium" style={{ color: s.text }}>{title.render ? title.render(r) : r[title.key]}</div>
                {aside && <div className="shrink-0">{aside.render ? aside.render(r) : r[aside.key]}</div>}
              </div>
              {meta.length > 0 && (
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 mt-2.5">
                  {meta.map((c) => (
                    <div key={c.key} className="min-w-0">
                      <dt className="text-[11px]" style={{ color: s.muted }}>{c.label}</dt>
                      <dd className="text-[13px] truncate tnum" style={{ color: s.text }}>{c.render ? c.render(r) : r[c.key]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {footer && <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>{footer.render(r)}</div>}
          </li>
        ))}
      </ul>
    </>
  );
}

export function Pagination({ page, pageSize, total, onPage }) {
  const s = useS();
  const pages = Math.max(Math.ceil(total / pageSize), 1);
  if (total <= pageSize) return total ? <p className="px-4 py-2.5 text-xs tnum" style={{ color: s.muted, borderTop: `1px solid ${s.lineSoft}` }}>{total} {total === 1 ? "result" : "results"}</p> : null;
  const from = (page - 1) * pageSize + 1, to = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5" style={{ borderTop: `1px solid ${s.lineSoft}` }}>
      <p className="text-xs tnum" style={{ color: s.muted }}>{from}–{to} of {total}</p>
      <div className="flex items-center gap-1">
        <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onPage(page - 1)} className="w-8 h-8 inline-flex items-center justify-center disabled:opacity-40" style={{ border: `1px solid ${s.line}`, borderRadius: s.r }}><ChevronLeft size={15} /></button>
        <span className="text-xs px-2 tnum" style={{ color: s.muted }}>Page {page} of {pages}</span>
        <button type="button" aria-label="Next page" disabled={page >= pages} onClick={() => onPage(page + 1)} className="w-8 h-8 inline-flex items-center justify-center disabled:opacity-40" style={{ border: `1px solid ${s.line}`, borderRadius: s.r }}><ChevronRight size={15} /></button>
      </div>
    </div>
  );
}

/* ---------------------------------- HELPERS ---------------------------------- */
/** search + filter + sort + paginate in one place; pages just describe their columns. */
export function useTable(rows, { sortAccessors = {}, initialSort = null, pageSize = 10 } = {}) {
  const [sort, setSort] = useState(initialSort);
  const [page, setPage] = useState(1);
  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const get = sortAccessors[sort.key] || ((r) => r[sort.key]);
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const x = get(a), y = get(b);
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (typeof x === "string" ? x.localeCompare(y) : x - y) * dir;
    });
  }, [rows, sort]);
  const pages = Math.max(Math.ceil(sorted.length / pageSize), 1);
  const cur = Math.min(page, pages);
  const visible = sorted.slice((cur - 1) * pageSize, cur * pageSize);
  const toggleSort = (key) => { setSort((p) => (p?.key === key ? { key, dir: p.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" })); setPage(1); };
  return { sort, setSort: (v) => { setSort(v); setPage(1); }, toggleSort, page: cur, setPage, pageSize, visible, total: sorted.length };
}

export function Thumb({ product, size = 36 }) {
  const s = useS();
  return (
    <span className="inline-block overflow-hidden shrink-0" style={{ width: size, height: size, borderRadius: 6, border: `1px solid ${s.lineSoft}` }}>
      <ProductArt product={product} size={Math.round(size * 0.7)} rounded={false} />
    </span>
  );
}

export function useWidth(ref, fallback = 640) {
  const [w, setW] = useState(fallback);
  useEffect(() => {
    if (!ref.current) return undefined;
    const measure = () => ref.current && setW(Math.max(Math.round(ref.current.getBoundingClientRect().width), 200));
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}
