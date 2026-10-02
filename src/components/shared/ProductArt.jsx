/* Product artwork is drawn, not fetched — keeps the original Vyra
   illustrated look and means zero image payload. The shape comes from the
   product's category, so new categories get sensible art for free. */
import React, { memo, useState } from "react";
import { resolveCategory } from "../../data/categories.js";
import { productImageUrl } from "../../services/api/client.js";

function Shape({ shape, color, accent, w = 120, h = 120 }) {
  const s = { medbox: MedBox, bottle: Bottle, bag: Bag, tube: Tube, device: Device, cosmetic: Cosmetic, carton: Carton, apparel: Apparel, box: BoxArt }[shape] || BoxArt;
  const Cmp = s;
  return <Cmp color={color} accent={accent} w={w} h={h} />;
}

const MedBox = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="22" y="30" width="76" height="66" rx="9" fill={color} />
    <rect x="22" y="30" width="76" height="20" rx="9" fill="#fff" opacity=".22" />
    <rect x="32" y="58" width="42" height="7" rx="3.5" fill="#fff" opacity=".85" />
    <rect x="32" y="71" width="28" height="6" rx="3" fill="#fff" opacity=".5" />
    <circle cx="84" cy="74" r="11" fill={accent} />
    <path d="M84 68v12M78 74h12" stroke={color} strokeWidth="3.4" strokeLinecap="round" />
    <rect x="30" y="20" width="60" height="14" rx="7" fill={accent} />
  </svg>
);
const Bottle = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="50" y="14" width="20" height="14" rx="4" fill={color} opacity=".7" />
    <path d="M44 30h32c4 0 7 3 7 7v56c0 5-4 9-9 9H46c-5 0-9-4-9-9V37c0-4 3-7 7-7z" fill={color} />
    <rect x="43" y="52" width="34" height="26" rx="5" fill={accent} />
    <rect x="48" y="60" width="24" height="4" rx="2" fill={color} opacity=".55" />
    <rect x="48" y="68" width="16" height="4" rx="2" fill={color} opacity=".35" />
  </svg>
);
const Bag = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <path d="M30 34h60l-6 68c-.3 3.4-3 6-6.4 6H42.4c-3.4 0-6.1-2.6-6.4-6z" fill={color} />
    <path d="M30 34h60l-1.6 18H31.6z" fill="#fff" opacity=".2" />
    <ellipse cx="60" cy="34" rx="30" ry="7" fill={color} opacity=".75" />
    <rect x="44" y="62" width="32" height="24" rx="6" fill={accent} />
    <rect x="50" y="70" width="20" height="4" rx="2" fill={color} opacity=".5" />
  </svg>
);
const Tube = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="52" y="12" width="16" height="16" rx="4" fill={color} opacity=".7" />
    <path d="M44 28h32v66c0 8-7 14-16 14s-16-6-16-14z" fill={color} />
    <rect x="44" y="94" width="32" height="14" rx="4" fill={color} opacity=".75" />
    <rect x="48" y="44" width="24" height="26" rx="5" fill={accent} />
    <rect x="53" y="52" width="14" height="4" rx="2" fill={color} opacity=".5" />
  </svg>
);
const Device = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="30" y="22" width="60" height="76" rx="14" fill={color} />
    <rect x="38" y="34" width="44" height="40" rx="8" fill={accent} />
    <path d="M44 56h8l4-8 6 16 5-10 4 6h9" stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="60" cy="86" r="6" fill="#fff" opacity=".65" />
  </svg>
);
const Cosmetic = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="48" y="10" width="24" height="18" rx="5" fill={color} opacity=".65" />
    <path d="M42 28h36c3.3 0 6 2.7 6 6v62c0 5-4 9-9 9H45c-5 0-9-4-9-9V34c0-3.3 2.7-6 6-6z" fill={color} />
    <rect x="41" y="46" width="38" height="32" rx="6" fill={accent} />
    <circle cx="60" cy="62" r="9" fill={color} opacity=".45" />
  </svg>
);
const Carton = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <path d="M38 34h44v62c0 5-4 9-9 9H47c-5 0-9-4-9-9z" fill={color} />
    <path d="M38 34l22-20 22 20z" fill={color} opacity=".7" />
    <rect x="44" y="58" width="32" height="26" rx="6" fill={accent} />
    <rect x="50" y="66" width="20" height="4" rx="2" fill={color} opacity=".5" />
  </svg>
);
const Apparel = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <path d="M46 24l-22 12 8 18 10-5v51c0 3 2 5 5 5h26c3 0 5-2 5-5V49l10 5 8-18-22-12-10 7z" fill={color} />
    <path d="M46 24l14 10 14-10-6-4-8 5-8-5z" fill={accent} />
    <rect x="50" y="70" width="20" height="5" rx="2.5" fill="#fff" opacity=".35" />
  </svg>
);
const BoxArt = ({ color, accent, w, h }) => (
  <svg viewBox="0 0 120 120" width={w} height={h} aria-hidden="true">
    <rect x="26" y="38" width="68" height="58" rx="10" fill={color} />
    <path d="M26 56h68" stroke="#fff" strokeOpacity=".25" strokeWidth="3" />
    <rect x="52" y="38" width="16" height="58" fill={accent} opacity=".9" />
    <rect x="34" y="28" width="52" height="14" rx="7" fill={accent} />
  </svg>
);

/** Card / hero artwork for any product in any category. */
export const ProductArt = memo(function ProductArt({ product, size = 120, variantId = null, rounded = true, bg, fit = "contain" }) {
  const cat = resolveCategory(product.categoryId);
  const variant = variantId ? (product.variants || []).find((v) => v.id === variantId) : null;
  const color = variant?.options?.color?.startsWith?.("#") ? variant.options.color : product.art?.color || cat?.fg || "#0FAF8F";
  const accent = product.art?.accent || cat?.tint || "#E9FAF6";
  const shape = product.art?.shape || cat?.image || "box";
  /* Sellers can upload real photos; the drawn artwork remains the fallback. The API sends images as
     { key, alt, primary } objects (no URL yet), the seller form uses plain data/http URLs — only a usable
     string URL is rendered, and a load failure drops back to the drawn art instead of a broken-image icon. */
  const [failed, setFailed] = useState(false);
  const first = product.images?.find?.((i) => i?.primary) || product.images?.[0];
  const candidate = typeof first === "string" ? first : first?.url || first?.src || (first?.key ? productImageUrl(first.key) : null);
  const photo = !failed && typeof candidate === "string" && /^(https?:|data:image\/|\/)/.test(candidate) ? candidate : null;
  if (photo) {
    const contain = fit === "contain";
    return (
      <div style={{ position: "relative", overflow: "hidden", borderRadius: rounded ? 18 : 0, width: "100%", height: "100%", minHeight: 0, background: bg || (contain ? "#fff" : accent) }}>
        <img
          src={photo}
          alt={product.name}
          onError={() => setFailed(true)}
          style={{ position: "absolute", top: contain ? "4%" : 0, left: contain ? "4%" : 0, width: contain ? "92%" : "100%", height: contain ? "92%" : "100%", objectFit: contain ? "contain" : "cover", display: "block" }}
        />
      </div>
    );
  }
  return (
    <div
      className="flex items-center justify-center"
      style={{ background: bg || accent, borderRadius: rounded ? 18 : 0, width: "100%", height: "100%" }}
    >
      <Shape shape={shape} color={color} accent="#FFFFFF" w={size} h={size} />
    </div>
  );
});

export const CategoryArt = memo(function CategoryArt({ category, size = 44 }) {
  return <Shape shape={category.image || "box"} color={category.fg} accent="#FFFFFF" w={size} h={size} />;
});
