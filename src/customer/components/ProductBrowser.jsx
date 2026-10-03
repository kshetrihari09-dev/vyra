import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { ProductCard } from "./ProductCard.jsx";
import { PillButton, Sheet, EmptyState, ProductCardSkeleton, Badge, Divider } from "../../components/shared/ui.jsx";
import { SlidersHorizontal, ArrowUpDown, X, Check, Search as SearchIcon } from "../../components/shared/Icon.jsx";
import { brandById } from "../../data/brands.js";
import { SORTS } from "../../utils/search.js";
import { productsApi } from "../../services/api/productsApi.js";
import { fmt } from "../../utils/format.js";

const PAGE = 12;
const BLANK_FILTERS = { brands: [], attrs: {}, minRating: 0, minDiscount: 0, inStockOnly: false, maxPrice: null };

/**
 * Shared listing surface for Category and Search — now SERVER-DRIVEN: filtering, sorting, ranking and pagination
 * happen in the API (GET /products), so the browser only ever holds the pages it has scrolled through.
 * Facets come from GET /products/facets, generated from the category's declared attribute schema, so a brand-new
 * category still gets working filters with no code change.
 *
 * Props: categoryId (browse a category tree) · q (search term) · brandId (fixed brand) · onTotal(n) (report the result count).
 */
export function ProductBrowser({ categoryId = null, q = "", brandId = null, emptyTitle = "No products found", onOpen, headerRight, onTotal }) {
  const { storeId, catalog } = useApp();
  const C = useC();
  const [filters, setFilters] = useState(BLANK_FILTERS);
  const [sort, setSort] = useState("relevance");
  const [sheet, setSheet] = useState(null); // "filter" | "sort"
  const [result, setResult] = useState({ items: [], total: 0, page: 0, loading: true, error: null });
  const [facetData, setFacetData] = useState({ attributes: [], brands: [], priceCeiling: 10 });
  const sentinel = useRef(null);
  const latest = useRef(0);

  useEffect(() => setFilters(BLANK_FILTERS), [categoryId]);

  /* Query params for the API. The fixed brand (Search-by-brand) wins over the brand filter chips. */
  const params = useMemo(() => {
    const p = { sort };
    if (categoryId) p.category = categoryId;
    if (q?.trim()) p.q = q.trim();
    const brands = brandId ? [brandId] : filters.brands;
    if (brands.length) p.brand = brands;
    if (filters.minRating) p.minRating = filters.minRating;
    if (filters.minDiscount) p.minDiscount = filters.minDiscount;
    if (filters.maxPrice != null) p.maxPrice = filters.maxPrice;
    if (filters.inStockOnly) { p.inStock = true; p.branch = storeId; }
    for (const [k, v] of Object.entries(filters.attrs)) if (v) p[`attr.${k}`] = v;
    return p;
  }, [sort, categoryId, q, brandId, filters, storeId]);
  const paramsKey = JSON.stringify(params);

  const fetchPage = useCallback(async (page, replace) => {
    const ticket = ++latest.current; // ignore responses from queries the user has already moved past
    setResult((r) => ({ ...r, loading: true, error: null, ...(replace ? { items: [], page: 0 } : {}) }));
    try {
      const res = await productsApi.list({ ...params, page, pageSize: PAGE });
      if (ticket !== latest.current) return;
      catalog.cacheProducts(res.items); // so cart / wishlist / detail can resolve these ids
      setResult((r) => ({ items: replace ? res.items : [...r.items, ...res.items], total: res.total, page, loading: false, error: null }));
      onTotal?.(res.total);
    } catch (err) {
      if (ticket === latest.current) setResult((r) => ({ ...r, loading: false, error: err.message || "Couldn't load products" }));
    }
  }, [params, catalog, onTotal]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchPage(1, true); }, [paramsKey]);

  useEffect(() => {
    let alive = true;
    productsApi.facets({ category: categoryId || undefined, q: q?.trim() || undefined })
      .then((f) => { if (alive) setFacetData(f); })
      .catch(() => {});
    return () => { alive = false; };
  }, [categoryId, q]);

  /* Infinite scroll — fetches the next page when the sentinel scrolls into view. */
  const hasMore = result.items.length < result.total;
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !result.loading && hasMore) fetchPage(result.page + 1, false);
    }, { rootMargin: "400px" });
    io.observe(el);
    return () => io.disconnect();
  }, [result.loading, result.page, hasMore, fetchPage]);

  const facets = facetData.attributes;
  const brandsPresent = brandId ? [] : facetData.brands;
  const priceCeiling = facetData.priceCeiling;
  const results = { length: result.total };

  const activeCount =
    filters.brands.length + Object.values(filters.attrs).filter(Boolean).length +
    (filters.minRating ? 1 : 0) + (filters.minDiscount ? 1 : 0) + (filters.inStockOnly ? 1 : 0) + (filters.maxPrice != null ? 1 : 0);

  const reset = () => setFilters(BLANK_FILTERS);
  const toggleBrand = (id) => setFilters((f) => ({ ...f, brands: f.brands.includes(id) ? f.brands.filter((b) => b !== id) : [...f.brands, id] }));
  const setAttr = (k, v) => setFilters((f) => ({ ...f, attrs: { ...f.attrs, [k]: f.attrs[k] === v ? null : v } }));

  return (
    <div>
      <div className="flex items-center gap-2 px-4 md:px-0 mb-3 sticky top-[118px] md:top-[112px] z-20 py-2" style={{ background: C.bg }}>
        <button onClick={() => setSheet("filter")} className="px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0"
          style={{ background: activeCount ? C.primary : C.white, color: activeCount ? "#fff" : C.navy, border: `1px solid ${activeCount ? C.primary : C.border}` }}>
          <SlidersHorizontal size={14} /> Filters{activeCount ? ` (${activeCount})` : ""}
        </button>
        <button onClick={() => setSheet("sort")} className="px-3.5 py-2.5 rounded-full text-xs font-bold flex items-center gap-1.5 shrink-0"
          style={{ background: C.white, color: C.navy, border: `1px solid ${C.border}` }}>
          <ArrowUpDown size={14} /> {SORTS.find((s) => s.id === sort).label}
        </button>
        <span className="text-xs ml-auto shrink-0" style={{ color: C.muted }}>{results.length} item{results.length === 1 ? "" : "s"}</span>
        {headerRight}
      </div>

      {activeCount > 0 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 md:px-0 mb-3">
          {filters.brands.map((b) => (
            <Chip key={b} label={brandById(b).name} onClear={() => toggleBrand(b)} />
          ))}
          {Object.entries(filters.attrs).filter(([, v]) => v).map(([k, v]) => (
            <Chip key={k} label={v} onClear={() => setAttr(k, v)} />
          ))}
          {filters.inStockOnly && <Chip label="In stock" onClear={() => setFilters((f) => ({ ...f, inStockOnly: false }))} />}
          {filters.minRating > 0 && <Chip label={`${filters.minRating}★ & up`} onClear={() => setFilters((f) => ({ ...f, minRating: 0 }))} />}
          {filters.minDiscount > 0 && <Chip label={`${filters.minDiscount}%+ off`} onClear={() => setFilters((f) => ({ ...f, minDiscount: 0 }))} />}
          {filters.maxPrice != null && <Chip label={`Under ${fmt(filters.maxPrice)}`} onClear={() => setFilters((f) => ({ ...f, maxPrice: null }))} />}
          <button onClick={reset} className="text-xs font-bold shrink-0 px-2" style={{ color: C.primary }}>Clear all</button>
        </div>
      )}

      {result.error ? (
        <EmptyState icon={SearchIcon} title="Couldn't load products" message={result.error} action="Try again" onAction={() => fetchPage(1, true)} />
      ) : result.total === 0 && !result.loading ? (
        <EmptyState icon={SearchIcon} title={emptyTitle} message="Try removing a filter or searching for something broader." action={activeCount ? "Clear filters" : null} onAction={reset} />
      ) : (
        <>
          <div className="vgrid px-4 md:px-0">
            {result.items.map((p) => <ProductCard key={p.id} product={p} onOpen={onOpen} />)}
          </div>
          {(hasMore || result.loading) && (
            <div ref={sentinel} className="vgrid px-4 md:px-0 mt-3">
              {Array.from({ length: result.items.length ? Math.min(PAGE, Math.max(result.total - result.items.length, 1)) : PAGE }).map((_, i) => <ProductCardSkeleton key={i} />)}
            </div>
          )}
        </>
      )}

      {/* Filters */}
      <Sheet open={sheet === "filter"} onClose={() => setSheet(null)} title="Filters"
        footer={
          <div className="flex gap-3">
            <PillButton variant="subtle" className="flex-1" onClick={reset}>Reset</PillButton>
            <PillButton className="flex-1" onClick={() => setSheet(null)}>Show {results.length} results</PillButton>
          </div>
        }>
        <div className="space-y-5">
          <FilterGroup title="Availability">
            <Toggle label="In stock at my store only" on={filters.inStockOnly} onToggle={() => setFilters((f) => ({ ...f, inStockOnly: !f.inStockOnly }))} />
          </FilterGroup>

          <FilterGroup title="Price">
            <input type="range" min={1} max={priceCeiling} step={1} value={filters.maxPrice ?? priceCeiling}
              onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))}
              className="w-full" style={{ accentColor: C.primary }} aria-label="Maximum price" />
            <p className="text-xs mt-1" style={{ color: C.muted }}>
              Up to <span className="font-bold" style={{ color: C.navy }}>{fmt(filters.maxPrice ?? priceCeiling)}</span>
            </p>
          </FilterGroup>

          {brandsPresent.length > 1 && (
            <FilterGroup title="Brand">
              <div className="flex flex-wrap gap-2">
                {brandsPresent.map((b) => (
                  <Option key={b.id} label={b.name} active={filters.brands.includes(b.id)} onClick={() => toggleBrand(b.id)} />
                ))}
              </div>
            </FilterGroup>
          )}

          {/* Category-declared facets */}
          {facets.map((f) => (
            <FilterGroup key={f.key} title={f.label}>
              <div className="flex flex-wrap gap-2">
                {f.values.map((v) => (
                  <Option key={v} label={v} active={filters.attrs[f.key] === v} onClick={() => setAttr(f.key, v)} />
                ))}
              </div>
            </FilterGroup>
          ))}

          <FilterGroup title="Rating">
            <div className="flex flex-wrap gap-2">
              {[4.5, 4, 3.5].map((r) => (
                <Option key={r} label={`${r}★ & up`} active={filters.minRating === r} onClick={() => setFilters((f) => ({ ...f, minRating: f.minRating === r ? 0 : r }))} />
              ))}
            </div>
          </FilterGroup>

          <FilterGroup title="Discount">
            <div className="flex flex-wrap gap-2">
              {[10, 20, 30].map((d) => (
                <Option key={d} label={`${d}% or more`} active={filters.minDiscount === d} onClick={() => setFilters((f) => ({ ...f, minDiscount: f.minDiscount === d ? 0 : d }))} />
              ))}
            </div>
          </FilterGroup>
        </div>
      </Sheet>

      {/* Sort */}
      <Sheet open={sheet === "sort"} onClose={() => setSheet(null)} title="Sort by">
        <div className="space-y-1">
          {SORTS.map((s) => (
            <button key={s.id} onClick={() => { setSort(s.id); setSheet(null); }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold"
              style={{ background: sort === s.id ? C.mint : "transparent", color: sort === s.id ? C.primary : C.navy }}>
              {s.label} {sort === s.id && <Check size={16} />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function Chip({ label, onClear }) {
  const C = useC();
  return (
    <span className="shrink-0 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: C.mint, color: C.primary }}>
      {label}<button aria-label={`Remove ${label}`} onClick={onClear}><X size={12} /></button>
    </span>
  );
}
function FilterGroup({ title, children }) {
  const C = useC();
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>{title}</p>
      {children}
    </div>
  );
}
function Option({ label, active, onClick }) {
  const C = useC();
  return (
    <button onClick={onClick} className="px-3 py-2 rounded-xl text-xs font-bold"
      style={{ background: active ? C.mint : C.white, border: `1.5px solid ${active ? C.primary : C.border}`, color: active ? C.primary : C.navy }}>
      {label}
    </button>
  );
}
function Toggle({ label, on, onToggle }) {
  const C = useC();
  return (
    <button onClick={onToggle} className="w-full flex items-center justify-between py-1">
      <span className="text-sm font-semibold" style={{ color: C.navy }}>{label}</span>
      <span className="w-11 h-6 rounded-full p-0.5 transition-colors" style={{ background: on ? C.primary : "#D6DFE2" }}>
        <span className="block w-5 h-5 rounded-full bg-white transition-transform" style={{ transform: on ? "translateX(20px)" : "none" }} />
      </span>
    </button>
  );
}
