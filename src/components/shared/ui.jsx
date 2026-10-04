import React, { useEffect } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { TONE } from "../../theme.js";
import {
  ChevronLeft, ChevronRight, Star, Heart, X, Check, AlertTriangle, Info, Loader2, Minus, Plus, Package,
} from "./Icon.jsx";

/* ------------------------------- BUTTONS ------------------------------- */
export function PillButton({ children, onClick, variant = "primary", className = "", size = "md", disabled, type = "button", full }) {
  const C = useC();
  const sizes = { sm: "px-3.5 py-2 text-xs", md: "px-5 py-3 text-sm", lg: "px-6 py-3.5 text-[15px]" };
  const styles = {
    primary: { background: disabled ? "#C9D4D8" : C.primary, color: "#fff", border: "1px solid transparent" },
    dark: { background: C.navy, color: "#fff", border: "1px solid transparent" },
    outline: { background: "transparent", color: C.primary, border: `1.5px solid ${C.primary}` },
    ghost: { background: C.mint, color: C.primary, border: "1px solid transparent" },
    subtle: { background: C.white, color: C.navy, border: `1px solid ${C.border}` },
    danger: { background: TONE.dangerBg, color: TONE.danger, border: "1px solid transparent" },
  };
  return (
    <button
      type={type} onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`rounded-full font-semibold inline-flex items-center justify-center gap-2 transition-opacity ${disabled ? "opacity-60 cursor-not-allowed" : "hover:opacity-90 active:opacity-80"} ${sizes[size]} ${full ? "w-full" : ""} ${className}`}
      style={styles[variant]}
    >
      {children}
    </button>
  );
}

export function IconCircleButton({ icon: IconCmp, onClick, badge, size = 40, ariaLabel, tone = "white" }) {
  const C = useC();
  return (
    <button aria-label={ariaLabel} onClick={onClick} className="relative rounded-full flex items-center justify-center shrink-0 transition-transform active:scale-95"
      style={{ width: size, height: size, background: tone === "white" ? C.white : C.mint, border: `1px solid ${C.border}` }}>
      <IconCmp size={18} style={{ color: C.navy }} />
      {badge > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
          style={{ background: TONE.danger, color: "#fff" }}>{badge > 99 ? "99+" : badge}</span>
      )}
    </button>
  );
}

export function QuantityStepper({ qty, onChange, min = 1, max = 99, size = "md" }) {
  const C = useC();
  const dim = size === "sm" ? 26 : 32;
  return (
    <div className="inline-flex items-center rounded-full" style={{ background: C.mint, border: `1px solid ${C.border}` }}>
      <button aria-label="Decrease quantity" onClick={() => onChange(Math.max(qty - 1, min - 1))} disabled={qty <= min - 1}
        className="flex items-center justify-center rounded-full disabled:opacity-40" style={{ width: dim, height: dim }}>
        <Minus size={14} style={{ color: C.primary }} />
      </button>
      <span className="font-bold text-sm tabular-nums px-1 min-w-[26px] text-center" style={{ color: C.navy }}>{qty}</span>
      <button aria-label="Increase quantity" onClick={() => onChange(Math.min(qty + 1, max))} disabled={qty >= max}
        className="flex items-center justify-center rounded-full disabled:opacity-40" style={{ width: dim, height: dim }}>
        <Plus size={14} style={{ color: C.primary }} />
      </button>
    </div>
  );
}

/* -------------------------------- ATOMS -------------------------------- */
export function Rating({ value, reviews, size = 13 }) {
  const C = useC();
  return (
    <span className="inline-flex items-center gap-1">
      <Star size={size} fill="#F5B301" style={{ color: "#F5B301" }} />
      <span className="font-semibold" style={{ color: C.navy, fontSize: size }}>{value}</span>
      {reviews != null && <span style={{ color: C.muted, fontSize: size - 1 }}>({reviews > 999 ? `${(reviews / 1000).toFixed(1)}k` : reviews})</span>}
    </span>
  );
}

export function Badge({ children, tone = "mint", className = "" }) {
  const C = useC();
  const tones = {
    mint: { background: C.mint, color: C.primary },
    navy: { background: C.navy, color: "#fff" },
    danger: { background: TONE.dangerBg, color: TONE.danger },
    warn: { background: TONE.warnBg, color: TONE.warn },
    info: { background: TONE.infoBg, color: TONE.info },
    ok: { background: TONE.okBg, color: TONE.ok },
    neutral: { background: "#EFF3F5", color: "#4A5F6B" },
  };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${className}`} style={tones[tone]}>{children}</span>;
}

export function FavoriteButton({ active, onClick, floating = true, size = 32 }) {
  const C = useC();
  return (
    <button aria-label={active ? "Remove from wishlist" : "Add to wishlist"}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={`rounded-full flex items-center justify-center transition-transform active:scale-90 ${floating ? "absolute top-2 right-2 z-10" : ""}`}
      style={{ width: size, height: size, background: C.white, boxShadow: "0 2px 8px rgba(6,63,80,.10)" }}>
      <Heart size={size * 0.46} fill={active ? TONE.danger : "none"} style={{ color: active ? TONE.danger : C.muted }} />
    </button>
  );
}

export function SectionHeader({ title, subtitle, onViewAll, actionLabel = "View all" }) {
  const C = useC();
  return (
    <div className="flex items-end justify-between gap-3 px-4 md:px-0 mb-2">
      <div className="min-w-0">
        <h2 className="font-extrabold text-[17px] md:text-xl leading-tight truncate" style={{ color: C.navy }}>{title}</h2>
        {subtitle && <p className="text-xs md:text-sm mt-0.5 truncate" style={{ color: C.muted }}>{subtitle}</p>}
      </div>
      {onViewAll && (
        <button onClick={onViewAll} className="text-xs md:text-sm font-bold flex items-center gap-0.5 shrink-0" style={{ color: C.primary }}>
          {actionLabel} <ChevronRight size={14} />
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, onBack, right }) {
  const C = useC();
  return (
    <div className="flex items-center gap-3 px-4 md:px-0 mb-4">
      {onBack && (
        <button aria-label="Go back" onClick={onBack} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <ChevronLeft size={18} style={{ color: C.navy }} />
        </button>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="font-extrabold text-lg md:text-2xl truncate" style={{ color: C.navy }}>{title}</h1>
        {subtitle && <p className="text-xs md:text-sm truncate" style={{ color: C.muted }}>{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

/* ---------------------------- STATE DISPLAYS ---------------------------- */
export function EmptyState({ icon: IconCmp = Package, title, message, action, onAction }) {
  const C = useC();
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.mint }}>
        <IconCmp size={26} style={{ color: C.primary }} />
      </div>
      <p className="font-bold text-base" style={{ color: C.navy }}>{title}</p>
      {message && <p className="text-sm mt-1 max-w-xs" style={{ color: C.muted }}>{message}</p>}
      {action && <div className="mt-5"><PillButton onClick={onAction}>{action}</PillButton></div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", message, onRetry }) {
  const C = useC();
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-14">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: TONE.dangerBg }}>
        <AlertTriangle size={24} style={{ color: TONE.danger }} />
      </div>
      <p className="font-bold" style={{ color: C.navy }}>{title}</p>
      {message && <p className="text-sm mt-1" style={{ color: C.muted }}>{message}</p>}
      {onRetry && <div className="mt-4"><PillButton variant="outline" onClick={onRetry}>Try again</PillButton></div>}
    </div>
  );
}

export function Skeleton({ className = "", style }) {
  return <div className={`animate-pulse rounded-xl ${className}`} style={{ background: "linear-gradient(90deg,#EEF3F4,#F7FAFA,#EEF3F4)", ...style }} />;
}

export function ProductCardSkeleton() {
  const C = useC();
  return (
    <div className="rounded-xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <Skeleton className="w-full" style={{ aspectRatio: "1 / 1", borderRadius: 0 }} />
      <div className="p-2">
        <Skeleton className="w-1/3 h-2 mb-2" />
        <Skeleton className="w-4/5 h-3 mb-2" />
        <Skeleton className="w-1/2 h-3" />
      </div>
    </div>
  );
}

export function Spinner({ size = 18 }) {
  const C = useC();
  return <Loader2 size={size} className="animate-spin" style={{ color: C.primary }} />;
}

export function InlineNotice({ tone = "info", children, icon: IconCmp }) {
  const map = { info: [TONE.infoBg, TONE.info, Info], warn: [TONE.warnBg, TONE.warn, AlertTriangle], danger: [TONE.dangerBg, TONE.danger, AlertTriangle], ok: [TONE.okBg, TONE.ok, Check] };
  const [bg, fg, Fallback] = map[tone] || map.info;
  const Cmp = IconCmp || Fallback;
  return (
    <div className="rounded-2xl p-3 flex items-start gap-2.5 text-sm" style={{ background: bg, color: fg }}>
      <Cmp size={16} className="shrink-0 mt-0.5" />
      <div className="flex-1 leading-snug">{children}</div>
    </div>
  );
}

/* ------------------------------ OVERLAYS ------------------------------- */
export function Sheet({ open, onClose, title, children, footer, side = "bottom" }) {
  const C = useC();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center md:justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0" style={{ background: "rgba(6,63,80,.45)" }} onClick={onClose} />
      <div className="relative w-full md:max-w-lg max-h-[88vh] flex flex-col rounded-t-3xl md:rounded-3xl overflow-hidden"
        style={{ background: C.bg, boxShadow: "0 -8px 40px rgba(6,63,80,.20)" }}>
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ background: C.white, borderBottom: `1px solid ${C.border}` }}>
          <h3 className="font-extrabold text-base" style={{ color: C.navy }}>{title}</h3>
          <button aria-label="Close" onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: C.mint }}>
            <X size={16} style={{ color: C.navy }} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
        {footer && <div className="p-4 shrink-0" style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = "Confirm", tone = "danger", onConfirm, onClose }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}
      footer={
        <div className="flex gap-3">
          <PillButton variant="subtle" className="flex-1" onClick={onClose}>Cancel</PillButton>
          <PillButton variant={tone === "danger" ? "danger" : "primary"} className="flex-1" onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</PillButton>
        </div>
      }>
      <p className="text-sm leading-relaxed" style={{ color: "#4A5F6B" }}>{message}</p>
    </Sheet>
  );
}

export function Toasts() {
  const { toasts, dispatch } = useApp();
  const C = useC();
  if (!toasts.length) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-[60] flex flex-col gap-2 w-[min(92vw,380px)]">
      {toasts.map((t) => (
        <button key={t.id} onClick={() => dispatch({ type: "TOAST_REMOVE", id: t.id })}
          className="rounded-2xl px-4 py-3 flex items-center gap-2.5 text-left w-full"
          style={{ background: C.navy, color: "#fff", boxShadow: "0 8px 30px rgba(6,63,80,.28)" }}>
          <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
            style={{ background: t.tone === "danger" ? TONE.danger : C.primary }}>
            {t.tone === "danger" ? <AlertTriangle size={13} color="#fff" /> : <Check size={13} color="#fff" />}
          </span>
          <span className="text-sm font-semibold flex-1">{t.message}</span>
        </button>
      ))}
    </div>
  );
}

export function Divider({ className = "" }) {
  const C = useC();
  return <div className={className} style={{ height: 1, background: C.border }} />;
}
