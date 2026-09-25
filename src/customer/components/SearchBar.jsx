import React, { useEffect, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Search, ScanLine, X, Clock, TrendingUp, Tag } from "../../components/shared/Icon.jsx";
import { searchApi } from "../../services/api/productsApi.js";
import { POPULAR_SEARCHES } from "../../data/seed.js";

/** Debounce hook — keeps typing cheap on large catalogues. */
export function useDebounced(value, delay = 220) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function SearchBar({ value, onChange, onSubmit, onPick, autoFocus, placeholder = "Search products, brands and categories" }) {
  const { dispatch, toast, products } = useApp();
  const C = useC();
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const debounced = useDebounced(value, 200);
  const [suggestions, setSuggestions] = useState([]);

  /* Ranked prefix suggestions come from the API (GET /search/suggest); stale answers are dropped. */
  useEffect(() => {
    const term = debounced.trim();
    if (!term) { setSuggestions([]); return undefined; }
    let alive = true;
    searchApi.suggest(term).then((list) => { if (alive) setSuggestions(list); }).catch(() => { if (alive) setSuggestions([]); });
    return () => { alive = false; };
  }, [debounced]);

  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const scan = async () => {
    /* Barcode scanning: the camera isn't available here, so we look up a known barcode through the same
       exact-barcode endpoint a real scanner would use, to prove the path end to end. */
    const withBarcode = products.filter((p) => p.barcode);
    const sample = withBarcode[Math.floor(Math.random() * withBarcode.length)]?.barcode;
    try {
      const hit = sample ? await searchApi.lookup(sample) : null;
      if (hit) { toast(`Scanned ${hit.name}`); onPick?.({ type: "product", id: hit.id }); }
      else toast("No product matched that barcode", "danger");
    } catch {
      toast("No product matched that barcode", "danger");
    }
  };

  const submit = () => {
    if (!value.trim()) return;
    dispatch({ type: "SEARCHED", q: value });
    setOpen(false);
    onSubmit?.();
  };

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center gap-2 rounded-full px-4 h-11 md:h-12" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <Search size={17} style={{ color: C.muted }} className="shrink-0" />
        <input
          value={value} autoFocus={autoFocus} placeholder={placeholder}
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          className="flex-1 bg-transparent outline-none text-sm min-w-0"
          style={{ color: C.navy }} aria-label="Search"
        />
        {value && (
          <button aria-label="Clear search" onClick={() => onChange("")} className="shrink-0"><X size={15} style={{ color: C.muted }} /></button>
        )}
        <button aria-label="Scan barcode" onClick={scan} className="shrink-0 pl-1" style={{ borderLeft: `1px solid ${C.border}` }}>
          <ScanLine size={17} style={{ color: C.primary }} />
        </button>
      </div>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-2 rounded-2xl overflow-hidden z-40 max-h-[60vh] overflow-y-auto"
          style={{ background: C.white, border: `1px solid ${C.border}`, boxShadow: "0 12px 34px rgba(6,63,80,.14)" }}>
          {value.trim() ? (
            suggestions.length ? (
              suggestions.map((s) => (
                <button key={`${s.type}-${s.id}`} onClick={() => { dispatch({ type: "SEARCHED", q: s.label }); setOpen(false); onPick?.(s); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:opacity-80" style={{ borderBottom: `1px solid ${C.border}` }}>
                  <span className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                    {s.type === "product" ? <Search size={13} style={{ color: C.primary }} /> : <Tag size={13} style={{ color: C.primary }} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold truncate" style={{ color: C.navy }}>{s.label}</span>
                    <span className="block text-[11px]" style={{ color: C.muted }}>{s.sub}</span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-4 py-4 text-sm" style={{ color: C.muted }}>No matches. Try a brand or category name.</p>
            )
          ) : (
            <RecentAndPopular onPick={(q) => { onChange(q); dispatch({ type: "SEARCHED", q }); setOpen(false); onSubmit?.(); }} />
          )}
        </div>
      )}
    </div>
  );
}

function RecentAndPopular({ onPick }) {
  const { recentSearches, dispatch } = useApp();
  const C = useC();
  return (
    <div className="p-4">
      {recentSearches.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Recent</span>
            <button onClick={() => dispatch({ type: "SEARCH_CLEAR" })} className="text-[11px] font-bold" style={{ color: C.primary }}>Clear</button>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            {recentSearches.map((q) => (
              <button key={q} onClick={() => onPick(q)} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
                style={{ background: C.bg, color: C.navy, border: `1px solid ${C.border}` }}>
                <Clock size={11} style={{ color: C.muted }} /> {q}
              </button>
            ))}
          </div>
        </>
      )}
      <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Popular</span>
      <div className="flex flex-wrap gap-2 mt-2">
        {POPULAR_SEARCHES.map((q) => (
          <button key={q} onClick={() => onPick(q)} className="px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5"
            style={{ background: C.mint, color: C.primary }}>
            <TrendingUp size={11} /> {q}
          </button>
        ))}
      </div>
    </div>
  );
}
