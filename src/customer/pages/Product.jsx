import React, { useEffect, useMemo, useRef, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PillButton, Rating, Badge, FavoriteButton, InlineNotice, SectionHeader, Divider, Sheet, PageHeader } from "../../components/shared/ui.jsx";
import { productsApi } from "../../services/api/productsApi.js";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { VariantSelector } from "../components/VariantSelector.jsx";
import { AttributeTable, AttributeChips } from "../components/AttributeTable.jsx";
import { ProductRail } from "../components/ProductCard.jsx";
import {
  ChevronLeft, Share2, Truck, ShieldCheck, RotateCcw, Star, FileText, Clock, Check, Plus, Minus, Loader2, MessageCircle, Headphones,
} from "../../components/shared/Icon.jsx";
import { brandById } from "../../data/brands.js";
import { sellerForProduct, sellerById } from "../../data/sellers.js";
import { resolveCategory, categoryPath, hasModule, categoryTreeIds } from "../../data/categories.js";
import { priceOf, defaultVariantId } from "../../utils/pricing.js";
import { stockState, maxAddable, fefoBatches, daysToExpiry } from "../../utils/inventory.js";
import { fmt } from "../../utils/format.js";
import { STORES, DELIVERY_OPTIONS } from "../../data/stores.js";
import { TONE } from "../../theme.js";

/** Resolves the product from the cache, or fetches it (GET /products/:id) when it isn't cached — e.g. a deep link
    or a product beyond the startup preload — instead of falling back to some other product. */
export default function Product({ nav, params }) {
  const { products, catalog } = useApp();
  const found = products.find((p) => p.id === params.productId);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (found || !params.productId) return undefined;
    let alive = true;
    setMissing(false);
    productsApi.get(params.productId)
      .then((p) => { if (alive) catalog.cacheProducts([p]); })
      .catch(() => { if (alive) setMissing(true); });
    return () => { alive = false; };
  }, [found, params.productId, catalog]);

  if (!found) {
    return <Page><PageHeader title={missing ? "Product not found" : "Loading…"} onBack={() => nav("home")} /></Page>;
  }
  return <ProductView key={found.id} nav={nav} params={params} product={found} />;
}

function ProductView({ nav, params, product }) {
  const { products, categories, storeId, wishlist, commerce, dispatch, toast, cart, prescriptions, session } = useApp();
  const C = useC();
  const [variantId, setVariantId] = useState(() => defaultVariantId(product));
  const [qty, setQty] = useState(product.moq || 1);
  const [tab, setTab] = useState("details");
  const [rxOpen, setRxOpen] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);
  const [busy, setBusy] = useState(null); // "cart" | "buy" while an action is being processed
  const busyRef = useRef(false);          // synchronous guard — state alone can't stop a same-tick double click
  const busyTimer = useRef(null);
  useEffect(() => () => clearTimeout(busyTimer.current), []);

  useEffect(() => {
    setVariantId(defaultVariantId(product));
    setQty(product.moq || 1);
    setTab("details");
    setImgIdx(0);
    dispatch({ type: "VIEWED", id: product.id });
  }, [product.id]);

  const cat = resolveCategory(product.categoryId, categories);
  const brand = brandById(product.brandId);
  const seller = sellerById(sellerForProduct(product));
  const { price, mrp, discountPct } = priceOf(product, variantId);
  const stock = stockState(product, variantId, storeId);
  const cap = Math.max(maxAddable(product, variantId, storeId), 1);
  const store = STORES.find((s) => s.id === storeId) || STORES[0];
  const isFav = wishlist.includes(product.id);
  const needsRx = !!product.flags?.prescriptionRequired && hasModule(product.categoryId, "prescription", categories);
  const rxStatus = prescriptions.find((r) => r.items.includes(product.id))?.status || "none";
  const inCart = cart.find((l) => l.productId === product.id && l.variantId === (variantId || null));

  const related = useMemo(() => {
    const ids = categoryTreeIds(cat?.root?.id || product.categoryId, categories);
    return products.filter((p) => ids.includes(p.categoryId) && p.id !== product.id).slice(0, 10);
  }, [product.id, products, categories]);

  const alsoBought = useMemo(
    () => products.filter((p) => p.id !== product.id && p.categoryId !== product.categoryId).sort((a, b) => b.sold - a.sold).slice(0, 3),
    [product.id, products]
  );

  const add = (buyNow = false) => {
    if (busyRef.current || stock.level === "out") return;
    if (product.variants?.length && !variantId) { toast("Choose an option first", "danger"); return; }
    busyRef.current = true;
    setBusy(buyNow ? "buy" : "cart");
    dispatch({ type: "CART_ADD", productId: product.id, variantId, qty });
    if (buyNow) { nav("cart"); return; }
    toast(`${product.name} added to cart`);
    busyTimer.current = setTimeout(() => { busyRef.current = false; setBusy(null); }, 700);
  };

  const share = async () => {
    const text = `${product.name} — ${fmt(price)} on Vyra`;
    try {
      if (navigator.share) await navigator.share({ title: product.name, text });
      else { await navigator.clipboard?.writeText(text); toast("Link copied"); }
    } catch { /* dismissed */ }
  };

  const batches = fefoBatches(product);

  /* Gallery: real photos when the product has more than one, otherwise the variant thumbnails (existing behaviour). */
  const photos = useMemo(() => (Array.isArray(product.images) ? product.images.filter(Boolean) : []), [product.images]);
  const hasPhotoGallery = photos.length > 1;
  const activePhoto = hasPhotoGallery ? photos[Math.min(imgIdx, photos.length - 1)] : null;
  const heroProduct = useMemo(() => (activePhoto ? { ...product, images: [activePhoto] } : product), [product, activePhoto]);
  const photoProducts = useMemo(() => (hasPhotoGallery ? photos.map((img) => ({ ...product, images: [img] })) : []), [product, photos, hasPhotoGallery]);
  const thumbVariants = product.variants?.length > 1 ? product.variants.slice(0, 6) : [];
  const out = stock.level === "out";
  const minQty = product.moq || 1;
  const dOpts = Object.fromEntries(DELIVERY_OPTIONS.map((d) => [d.id, d]));
  const freeAbove = dOpts.standard?.freeAbove;
  const expressFee = dOpts.express?.fee;
  const deliveryNote = freeAbove != null && expressFee != null
    ? `Free over ${fmt(freeAbove)} · express from ${fmt(expressFee)}`
    : "Free over Rs. 25 · express from Rs. 2.99";
  const rxCategory = hasModule(product.categoryId, "prescription", categories);


  return (
    <Page wide className="pdp md:pt-6" >
      <div style={{ "--pdp-accent": C.primary, "--pdp-border": C.border, "--pdp-mint": C.mint }} className="min-w-0">
      <div className="px-4 md:px-0 flex items-center gap-2 mb-3">
        <button aria-label="Go back" onClick={() => nav("home")} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
          style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <ChevronLeft size={18} style={{ color: C.navy }} />
        </button>
        <nav aria-label="Breadcrumb" className="flex-1 min-w-0 flex items-center gap-1 text-[11px] truncate" style={{ color: C.muted }}>
          {categoryPath(product.categoryId, categories).map((c, i) => (
            <button key={c.id} onClick={() => nav("category", { categoryId: c.id })} className="font-semibold truncate">
              {i > 0 ? " / " : ""}{c.name}
            </button>
          ))}
        </nav>
        <button aria-label="Share" onClick={share} className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <Share2 size={16} style={{ color: C.navy }} />
        </button>
      </div>

      <div className="md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-6 lg:gap-10 md:items-start">
        {/* Gallery */}
        <div className="px-4 md:px-0 min-w-0">
          <div className="relative rounded-3xl overflow-hidden h-[300px] sm:h-[380px] lg:h-[460px]" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <ProductArt key={imgIdx} product={heroProduct} variantId={variantId} size={230} rounded={false} />
            <FavoriteButton active={isFav} onClick={() => {
              if (!session.signedIn) { toast("Sign in to save favorites"); return; }
              commerce.toggleWishlist(product.id).catch((err) => toast(err.message || "Couldn't update favorites", "danger"));
            }} size={38} />
            {discountPct > 0 && (
              <span className="absolute top-3 left-3 px-2 py-0.5 rounded-md text-[11px] font-extrabold" style={{ background: TONE.danger, color: "#fff" }}>{discountPct}% OFF</span>
            )}
          </div>
          {(hasPhotoGallery || thumbVariants.length > 0) && (
            <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar py-0.5" role="group" aria-label="Product images">
              {hasPhotoGallery
                ? photoProducts.map((p, i) => (
                  <button key={i} type="button" aria-label={`Show image ${i + 1} of ${photos.length}`} aria-current={i === imgIdx} onClick={() => setImgIdx(i)}
                    className="pdp-thumb w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ background: C.white }}>
                    <ProductArt product={p} variantId={variantId} size={42} rounded={false} />
                  </button>
                ))
                : thumbVariants.map((v) => (
                  <button key={v.id} type="button" aria-label={`Show ${v.label}`} aria-current={v.id === variantId} onClick={() => setVariantId(v.id)}
                    className="pdp-thumb w-16 h-16 rounded-xl overflow-hidden shrink-0" style={{ background: C.white }}>
                    <ProductArt product={product} variantId={v.id} size={42} rounded={false} />
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* Buy box */}
        <div className="px-4 md:px-0 mt-5 md:mt-0 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <button onClick={() => nav("search", { brandId: brand.id })} className="text-[11px] font-bold uppercase tracking-[.08em]"
              style={{ color: C.muted }}>{brand.name}</button>
            {needsRx && <Badge tone="info"><ShieldCheck size={11} /> Prescription required</Badge>}
            {(product.tags || []).includes("new") && <Badge tone="warn">New</Badge>}
          </div>

          <h1 className="font-extrabold text-2xl md:text-[32px] leading-tight break-words" style={{ color: C.navy }}>{product.name}</h1>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 text-xs" style={{ color: C.muted }}>
            <Rating value={product.rating} reviews={product.reviews} size={13} />
            {product.sold > 0 && <><span aria-hidden="true">·</span><span>{product.sold.toLocaleString()} sold</span></>}
          </div>

          <div className="mt-2.5 empty:hidden"><AttributeChips product={product} /></div>

          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-4">
            <span className="font-extrabold text-[32px] leading-none md:text-4xl" style={{ color: C.navy }}>{fmt(price)}</span>
            {mrp > price && <span className="text-base line-through" style={{ color: C.muted }}>{fmt(mrp)}</span>}
            {discountPct > 0 && <span className="text-sm font-bold" style={{ color: TONE.ok }}>Save {fmt(mrp - price)}</span>}
          </div>
          <p className="text-[11px] mt-1" style={{ color: C.muted }}>Inclusive of all taxes · per {product.unit}</p>

          {product.variants?.length > 0 && (
            <div className="mt-4"><VariantSelector product={product} selectedId={variantId} onSelect={setVariantId} /></div>
          )}

          {/* Stock + seller + delivery + returns */}
          <div className="mt-4 rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div className="px-4 py-3 flex items-center flex-wrap gap-x-2 gap-y-0.5">
              <span className="w-2 h-2 rounded-full shrink-0" aria-hidden="true" style={{ background: out ? TONE.danger : stock.level === "low" ? TONE.warn : TONE.ok }} />
              <span className="text-sm font-bold" style={{ color: out ? TONE.danger : C.navy }}>{stock.label}</span>
              <span className="text-xs" style={{ color: C.muted }}>at {store.name}</span>
            </div>
            <Divider />
            <div className="px-4 py-3 flex items-center flex-wrap gap-x-2.5 gap-y-1">
              <span className="text-xs" style={{ color: C.muted }}>Sold by</span>
              <span className="text-xs font-bold" style={{ color: C.navy }}>{seller.name}</span>
              {seller.firstParty && <Badge tone="mint">Official</Badge>}
              {!seller.firstParty && seller.rating != null && <Rating value={seller.rating} size={11} />}
            </div>
            <Divider />
            <div className="px-4 py-3 flex items-start gap-3">
              <Truck size={16} style={{ color: C.primary }} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: C.navy }}>
                  {product.deliveryAvailable ? `Delivery in ${store.etaMinutes} minutes` : "Delivery unavailable"}
                </p>
                <p className="text-xs" style={{ color: C.muted }}>{deliveryNote}</p>
              </div>
            </div>
            <Divider />
            <div className="px-4 py-3 flex items-start gap-3">
              <RotateCcw size={16} style={{ color: C.primary }} className="mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: C.navy }}>{rxCategory ? "Non-returnable item" : "7-day easy returns"}</p>
                <p className="text-xs" style={{ color: C.muted }}>
                  {rxCategory ? "Medicines cannot be returned once dispensed." : "Unused items in original packaging."}
                </p>
              </div>
            </div>
          </div>

          {/* Prescription module — only for categories that declare it */}
          {needsRx && (
            <div className="mt-4">
              {rxStatus === "approved" ? (
                <InlineNotice tone="ok" icon={Check}>Your prescription for this item has been verified by a pharmacist.</InlineNotice>
              ) : rxStatus === "pending" ? (
                <InlineNotice tone="warn" icon={Clock}>A pharmacist is reviewing your uploaded prescription. You'll be notified within 30 minutes.</InlineNotice>
              ) : (
                <div className="rounded-2xl p-4" style={{ background: TONE.infoBg }}>
                  <p className="text-sm font-bold" style={{ color: TONE.info }}>This medicine needs a prescription</p>
                  <p className="text-xs mt-1 mb-3" style={{ color: TONE.info, opacity: 0.85 }}>
                    Upload it now or at checkout. Our pharmacist verifies every order before it's dispensed.
                  </p>
                  <PillButton size="sm" onClick={() => nav("prescription", { productId: product.id })}>
                    <FileText size={14} /> Upload prescription
                  </PillButton>
                </div>
              )}
            </div>
          )}

          {/* Desktop actions — mobile uses the sticky bar below so there is only ever one set of cart actions on screen */}
          <div className="hidden md:flex items-center gap-3 mt-5">
            <QtyControl qty={qty} onChange={setQty} min={minQty} max={cap} disabled={out} />
            <CtaButton variant="outline" className="flex-1" onClick={() => add(false)} disabled={out} loading={busy === "cart"} label="Add to Cart">
              <Plus size={16} aria-hidden="true" /> Add to Cart
            </CtaButton>
            <CtaButton className="flex-[1.25]" onClick={() => add(true)} disabled={out} loading={busy === "buy"} label="Buy Now">
              {out ? "Out of stock" : "Buy Now"}
            </CtaButton>
          </div>
          {inCart && <p className="hidden md:block text-xs mt-2" style={{ color: C.primary }}>{inCart.qty} already in your cart</p>}
        </div>
      </div>


      {/* Tabs */}
      <div className="px-4 md:px-0 mt-8">
        <div role="tablist" aria-label="Product information" className="flex gap-2 overflow-x-auto no-scrollbar mb-4 py-0.5">
          {[
            { id: "details", label: "Details" },
            { id: "specs", label: "Specifications" },
            { id: "reviews", label: `Reviews (${product.reviews})` },
            ...(batches.length ? [{ id: "batch", label: "Batch & expiry" }] : []),
          ].map((t) => (
            <button key={t.id} type="button" role="tab" id={`pdp-tab-${t.id}`} aria-selected={tab === t.id} aria-controls="pdp-tabpanel" onClick={() => setTab(t.id)}
              className="px-4 h-10 rounded-full text-[13px] font-bold shrink-0 transition-colors"
              style={{ background: tab === t.id ? C.primary : C.white, color: tab === t.id ? "#fff" : C.navy, border: `1px solid ${tab === t.id ? C.primary : C.border}` }}>
              {t.label}
            </button>
          ))}
        </div>

        <div id="pdp-tabpanel" role="tabpanel" aria-labelledby={`pdp-tab-${tab}`}>
        {tab === "details" && (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{product.description}</p>
            {product.composition && <Detail title="Composition" body={product.composition} />}
            {product.usage && <Detail title="Directions for use" body={product.usage} />}
            {product.sideEffects && <Detail title="Safety information" body={product.sideEffects} />}
            {hasModule(product.categoryId, "prescription", categories) && (
              <button onClick={() => nav("support", { topic: "pharmacist" })}
                className="w-full rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.mint }}>
                <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.white }}>
                  <MessageCircle size={17} style={{ color: C.primary }} />
                </span>
                <span>
                  <span className="block font-bold text-sm" style={{ color: C.navy }}>Talk to a pharmacist</span>
                  <span className="block text-xs" style={{ color: C.muted }}>Free advice about dosage and interactions</span>
                </span>
              </button>
            )}
          </div>
        )}

        {tab === "specs" && <AttributeTable product={product} />}

        {tab === "reviews" && <Reviews product={product} />}

        {tab === "batch" && (
          <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <p className="px-4 py-3 text-xs" style={{ color: C.muted, borderBottom: `1px solid ${C.border}` }}>
              Dispensed First Expiry First Out — you always receive the batch closest to expiry that still has plenty of shelf life.
            </p>
            {batches.map((b, i) => {
              const days = daysToExpiry(b.expiry);
              return (
                <div key={b.batch} className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
                  <div>
                    <p className="text-sm font-bold" style={{ color: C.navy }}>Batch {b.batch}</p>
                    <p className="text-xs" style={{ color: C.muted }}>Expires {b.expiry} · {b.qty} in stock</p>
                  </div>
                  <Badge tone={days < 60 ? "warn" : "ok"}>{days} days left</Badge>
                </div>
              );
            })}
          </div>
        )}
        </div>
      </div>

      {/* Frequently bought together */}
      {alsoBought.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Frequently Bought Together" />
          <div className="px-4 md:px-0 rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {[product, ...alsoBought.slice(0, 2)].map((p, i) => (
                <React.Fragment key={p.id}>
                  {i > 0 && <Plus size={14} style={{ color: C.muted }} className="shrink-0" />}
                  <button onClick={() => p.id !== product.id && nav("product", { productId: p.id })} className="shrink-0 text-center w-24">
                    <span className="block w-24 h-20 rounded-xl overflow-hidden" style={{ background: C.bg }}>
                      <ProductArt product={p} size={56} rounded={false} />
                    </span>
                    <span className="block text-[11px] font-semibold mt-1 line-clamp-2" style={{ color: C.navy }}>{p.name}</span>
                  </button>
                </React.Fragment>
              ))}
            </div>
            <Divider className="my-3" />
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-bold" style={{ color: C.navy }}>
                Bundle total {fmt([product, ...alsoBought.slice(0, 2)].reduce((s, p) => s + priceOf(p).price, 0))}
              </span>
              <PillButton size="sm" onClick={() => {
                [product, ...alsoBought.slice(0, 2)].forEach((p) => dispatch({ type: "CART_ADD", productId: p.id, variantId: defaultVariantId(p), qty: 1 }));
                toast("Bundle added to cart");
              }}>Add all three</PillButton>
            </div>
          </div>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-8">
          <SectionHeader title="Similar Products" subtitle={`More in ${cat?.root?.name || cat?.name}`} onViewAll={() => nav("category", { categoryId: cat?.root?.id || product.categoryId })} />
          <ProductRail products={related} onOpen={(id) => nav("product", { productId: id })} />
        </section>
      )}


      {/* Mobile sticky purchase bar */}
      <div className="md:hidden fixed left-0 right-0 bottom-[68px] z-30 px-3 py-2.5 flex items-center gap-2"
        style={{ background: C.white, borderTop: `1px solid ${C.border}` }}>
        {out ? (
          <CtaButton className="flex-1" disabled label="Out of stock" compact>Out of stock</CtaButton>
        ) : (
          <>
            <QtyControl qty={qty} onChange={setQty} min={minQty} max={cap} compact />
            <CtaButton variant="outline" className="flex-1 min-w-0" onClick={() => add(false)} loading={busy === "cart"} label="Add to Cart" compact>
              <span className="min-[400px]:hidden">Add</span><span className="hidden min-[400px]:inline">Add to Cart</span>
            </CtaButton>
            <CtaButton className="flex-1 min-w-0" onClick={() => add(true)} loading={busy === "buy"} label="Buy Now" compact>Buy Now</CtaButton>
          </>
        )}
      </div>
      </div>
    </Page>
  );
}

/** Compact quantity control. Bounded by [min, max] so quantity can never drop to 0 (removal lives in the cart). */
function QtyControl({ qty, onChange, min, max, disabled, compact }) {
  const C = useC();
  const h = compact ? 44 : 48;
  const btn = h - 10;
  const atMin = qty <= min, atMax = qty >= max;
  return (
    <div role="group" aria-label="Quantity" className="inline-flex items-center rounded-full shrink-0"
      style={{ height: h, background: C.white, border: `1.5px solid ${C.border}`, padding: 3, opacity: disabled ? 0.6 : 1 }}>
      <button type="button" aria-label="Decrease quantity" disabled={disabled || atMin} onClick={() => onChange(Math.max(qty - 1, min))}
        className="pdp-cta rounded-full flex items-center justify-center disabled:opacity-35" style={{ width: btn - 6, height: btn - 6, background: C.mint }}>
        <Minus size={15} style={{ color: C.primary }} />
      </button>
      <span aria-live="polite" className="font-bold text-sm tabular-nums text-center min-w-[30px] px-1" style={{ color: C.navy }}>{qty}</span>
      <button type="button" aria-label="Increase quantity" disabled={disabled || atMax} onClick={() => onChange(Math.min(qty + 1, max))}
        className="pdp-cta rounded-full flex items-center justify-center disabled:opacity-35" style={{ width: btn - 6, height: btn - 6, background: C.mint }}>
        <Plus size={15} style={{ color: C.primary }} />
      </button>
    </div>
  );
}

/** Pill CTA with consistent height, hover/active/disabled styling and a loading state. */
function CtaButton({ children, onClick, variant = "primary", disabled, loading, label, className = "", compact }) {
  const C = useC();
  const off = disabled;
  const style = variant === "outline"
    ? { background: C.white, color: off ? "#9AA9B0" : C.primary, border: `1.5px solid ${off ? "#D5DEE1" : C.primary}` }
    : { background: off ? "#C9D4D8" : C.primary, color: "#fff", border: "1.5px solid transparent" };
  return (
    <button type="button" aria-label={label} aria-busy={loading || undefined} disabled={off || loading} onClick={onClick}
      className={`pdp-cta rounded-full font-bold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${compact ? "h-11 px-3 text-[13px]" : "h-12 px-5 text-sm"} ${className}`}
      style={{ ...style, opacity: loading ? 0.85 : 1 }}>
      {loading ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : null}
      {loading && variant === "primary" ? <span>Please wait…</span> : children}
    </button>
  );
}


function Detail({ title, body }) {
  const C = useC();
  return (
    <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
      <p className="text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: C.muted }}>{title}</p>
      <p className="text-sm leading-relaxed" style={{ color: C.navy }}>{body}</p>
    </div>
  );
}

function Reviews({ product }) {
  const C = useC();
  const dist = [
    { stars: 5, pct: 68 }, { stars: 4, pct: 21 }, { stars: 3, pct: 7 }, { stars: 2, pct: 3 }, { stars: 1, pct: 1 },
  ];
  const samples = [
    { name: "Priya S.", stars: 5, when: "2 weeks ago", text: "Exactly as described and it arrived within the half hour. Packaging was sealed and intact." },
    { name: "Daniel R.", stars: 4, when: "1 month ago", text: "Good value for the price. Would have liked a slightly larger pack option." },
    { name: "Mei L.", stars: 5, when: "2 months ago", text: "Second time ordering this. Consistent quality and the reorder flow takes about ten seconds." },
  ];
  return (
    <div className="space-y-4">
      <div className="rounded-2xl p-4 flex gap-5" style={{ background: C.white, border: `1px solid ${C.border}` }}>
        <div className="text-center shrink-0">
          <p className="font-extrabold text-3xl" style={{ color: C.navy }}>{product.rating}</p>
          <div className="flex gap-0.5 justify-center my-1">
            {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={11} fill={i <= Math.round(product.rating) ? "#F5B301" : "none"} style={{ color: "#F5B301" }} />)}
          </div>
          <p className="text-[11px]" style={{ color: C.muted }}>{product.reviews} reviews</p>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {dist.map((d) => (
            <div key={d.stars} className="flex items-center gap-2">
              <span className="text-[11px] w-3" style={{ color: C.muted }}>{d.stars}</span>
              <span className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: C.bg }}>
                <span className="block h-full rounded-full" style={{ width: `${d.pct}%`, background: C.primary }} />
              </span>
              <span className="text-[11px] w-8 text-right" style={{ color: C.muted }}>{d.pct}%</span>
            </div>
          ))}
        </div>
      </div>
      {samples.map((r) => (
        <div key={r.name} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: C.mint, color: C.primary }}>
              {r.name.slice(0, 1)}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold" style={{ color: C.navy }}>{r.name}</p>
              <div className="flex items-center gap-1.5">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => <Star key={i} size={9} fill={i <= r.stars ? "#F5B301" : "none"} style={{ color: "#F5B301" }} />)}
                </div>
                <span className="text-[10px]" style={{ color: C.muted }}>{r.when}</span>
              </div>
            </div>
          </div>
          <p className="text-sm leading-relaxed" style={{ color: C.muted }}>{r.text}</p>
        </div>
      ))}
    </div>
  );
}
