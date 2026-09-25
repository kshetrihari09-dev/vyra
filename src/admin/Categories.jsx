import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { PillButton, Badge, Sheet, Divider, InlineNotice } from "../components/shared/ui.jsx";
import { Icon, Plus, Trash2, LayoutGrid, Check } from "../components/shared/Icon.jsx";
import { topCategories, childrenOf } from "../data/categories.js";
import { ICON_NAMES } from "../components/shared/Icon.jsx";

const TINTS = [
  { tint: "#E9FAF6", fg: "#0FAF8F" }, { tint: "#E7F0FC", fg: "#2B6CB0" }, { tint: "#FDECE6", fg: "#D65D46" },
  { tint: "#F1ECFC", fg: "#7C5CD6" }, { tint: "#FCF3E3", fg: "#C98A2E" }, { tint: "#EFF3F5", fg: "#4A5F6B" },
];
const SHAPES = ["box", "bag", "bottle", "medbox", "device", "tube", "cosmetic", "carton", "apparel"];
const PICKABLE_ICONS = ["ShoppingBasket", "Shirt", "Smartphone", "Gem", "PawPrint", "CookingPot", "PenLine", "Baby", "Sparkles", "Activity", "Leaf", "Watch", "Wheat", "Droplets", "Sun", "Package"];

const blank = () => ({
  id: "", name: "", slug: "", parent: null, order: 99, status: "active",
  icon: "Package", image: "box", tint: TINTS[0].tint, fg: TINTS[0].fg,
  unitLabel: "unit", description: "", attributes: [], modules: [],
});

/**
 * Categories created here are immediately live on the storefront: navigation,
 * filters, the specification table and product forms all read this schema.
 * Nothing in the customer UI needs to change for a new department.
 */
export default function AdminCategories() {
  const { categories, products, catalog, toast } = useApp();
  const C = useC();
  const [draft, setDraft] = useState(null);
  const [attrDraft, setAttrDraft] = useState({ key: "", label: "", filterable: true, highlight: false });

  const tops = topCategories(categories);

  const [busy, setBusy] = useState(false);

  /* Categories are written to the API (validated + audited server-side); the storefront refreshes from the response. */
  const save = async () => {
    if (!draft.name.trim()) { toast("Give the category a name", "danger"); return; }
    const id = draft.id || draft.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const exists = categories.some((c) => c.id === id);
    setBusy(true);
    try {
      const saved = await catalog.saveCategory({ ...draft, id, slug: draft.slug || id }, { isNew: !exists });
      setDraft(null);
      toast(exists ? "Category updated" : `${saved.name} is live on the storefront`);
    } catch (err) {
      toast(err.message || "Couldn't save the category", "danger");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (id) => {
    try { await catalog.toggleCategory(id); } catch (err) { toast(err.message || "Couldn't change the category", "danger"); }
  };

  const addAttr = () => {
    if (!attrDraft.label.trim()) return;
    const key = attrDraft.key || attrDraft.label.toLowerCase().replace(/[^a-z0-9]+/g, "");
    setDraft({ ...draft, attributes: [...draft.attributes, { ...attrDraft, key, type: "text", options: null }] });
    setAttrDraft({ key: "", label: "", filterable: true, highlight: false });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm" style={{ color: C.muted }}>{categories.length} categories · {tops.length} departments</p>
        <PillButton size="sm" onClick={() => setDraft(blank())}><Plus size={14} /> New category</PillButton>
      </div>

      <InlineNotice tone="info" icon={LayoutGrid}>
        Add a department with its own attributes — say “Sports &amp; Fitness” with Size, Material and Weight — and the storefront picks it up at once: navigation, filters and product specs all follow this schema.
      </InlineNotice>

      <div className="space-y-3 mt-4">
        {tops.map((cat) => (
          <div key={cat.id} className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div className="flex items-center gap-3">
              <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: cat.tint }}>
                <Icon name={cat.icon} size={19} style={{ color: cat.fg }} />
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: C.navy }}>{cat.name}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>
                  {products.filter((p) => p.categoryId === cat.id || childrenOf(cat.id, categories).some((s) => s.id === p.categoryId)).length} products ·
                  {" "}{(cat.attributes || []).length} attributes · order {cat.order}
                </p>
              </div>
              <Badge tone={cat.status === "active" ? "ok" : "neutral"}>{cat.status}</Badge>
              <button onClick={() => setDraft({ ...cat, attributes: cat.attributes || [], modules: cat.modules || [] })}
                className="text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: C.mint, color: C.primary }}>Edit</button>
            </div>
            {childrenOf(cat.id, categories).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {childrenOf(cat.id, categories).map((s) => (
                  <button key={s.id} onClick={() => setDraft({ ...s, attributes: s.attributes || [], modules: s.modules || [] })}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-bold" style={{ background: s.tint, color: s.fg }}>{s.name}</button>
                ))}
              </div>
            )}
            <button onClick={() => toggle(cat.id)} className="text-[11px] font-bold mt-3" style={{ color: C.muted }}>
              {cat.status === "active" ? "Deactivate" : "Activate"}
            </button>
          </div>
        ))}
      </div>

      <Sheet open={!!draft} onClose={() => setDraft(null)} title={draft?.id ? "Edit category" : "New category"}
        footer={<PillButton full onClick={save} disabled={busy}>{busy ? "Saving…" : draft?.id ? "Save category" : "Create category"}</PillButton>}>
        {draft && (
          <div className="space-y-4">
            <Field label="Name" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="Sports & Fitness" />
            <Field label="Description" value={draft.description} onChange={(v) => setDraft({ ...draft, description: v })} placeholder="Gear for training at home and outdoors." />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit label" value={draft.unitLabel} onChange={(v) => setDraft({ ...draft, unitLabel: v })} placeholder="piece" />
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Parent</label>
                <select value={draft.parent || ""} onChange={(e) => setDraft({ ...draft, parent: e.target.value || null })}
                  className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }}>
                  <option value="">None (top level)</option>
                  {tops.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Icon</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {PICKABLE_ICONS.map((n) => (
                  <button key={n} onClick={() => setDraft({ ...draft, icon: n })} className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: draft.icon === n ? draft.tint : C.white, border: `1.5px solid ${draft.icon === n ? draft.fg : C.border}` }}>
                    <Icon name={n} size={16} style={{ color: draft.icon === n ? draft.fg : C.muted }} />
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Colour &amp; artwork</label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {TINTS.map((t) => (
                  <button key={t.fg} onClick={() => setDraft({ ...draft, tint: t.tint, fg: t.fg })} className="w-10 h-10 rounded-xl"
                    style={{ background: t.tint, border: `2px solid ${draft.fg === t.fg ? t.fg : "transparent"}` }}>
                    <span className="block w-4 h-4 rounded-full mx-auto" style={{ background: t.fg }} />
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {SHAPES.map((s) => (
                  <button key={s} onClick={() => setDraft({ ...draft, image: s })} className="px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
                    style={{ background: draft.image === s ? C.mint : C.white, border: `1px solid ${draft.image === s ? C.primary : C.border}`, color: draft.image === s ? C.primary : C.navy }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <Divider />

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Attribute schema ({draft.attributes.length})</p>
              <div className="space-y-2 mb-3">
                {draft.attributes.map((a, i) => (
                  <div key={a.key + i} className="flex items-center gap-2 rounded-xl px-3 py-2" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold" style={{ color: C.navy }}>{a.label}</p>
                      <p className="text-[10px]" style={{ color: C.muted }}>
                        key: {a.key}{a.filterable ? " · filterable" : ""}{a.highlight ? " · highlighted" : ""}
                      </p>
                    </div>
                    <button aria-label="Remove attribute" onClick={() => setDraft({ ...draft, attributes: draft.attributes.filter((_, j) => j !== i) })}>
                      <Trash2 size={13} style={{ color: C.muted }} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="rounded-xl p-3 space-y-2" style={{ background: C.mint }}>
                <input value={attrDraft.label} onChange={(e) => setAttrDraft({ ...attrDraft, label: e.target.value })}
                  placeholder="Attribute label (e.g. Material)"
                  className="w-full rounded-lg px-3 h-10 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
                <div className="flex gap-2">
                  <Toggle label="Filterable" on={attrDraft.filterable} onToggle={() => setAttrDraft({ ...attrDraft, filterable: !attrDraft.filterable })} />
                  <Toggle label="Show as chip" on={attrDraft.highlight} onToggle={() => setAttrDraft({ ...attrDraft, highlight: !attrDraft.highlight })} />
                  <button onClick={addAttr} className="ml-auto px-3 py-2 rounded-lg text-xs font-bold" style={{ background: C.primary, color: "#fff" }}>Add</button>
                </div>
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Modules</p>
              <div className="flex gap-2">
                {["prescription", "batch"].map((m) => (
                  <button key={m} onClick={() => setDraft({ ...draft, modules: draft.modules.includes(m) ? draft.modules.filter((x) => x !== m) : [...draft.modules, m] })}
                    className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
                    style={{ background: draft.modules.includes(m) ? C.mint : C.white, border: `1.5px solid ${draft.modules.includes(m) ? C.primary : C.border}`, color: draft.modules.includes(m) ? C.primary : C.navy }}>
                    {draft.modules.includes(m) && <Check size={12} />} {m === "prescription" ? "Prescription required" : "Batch & expiry tracking"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  const C = useC();
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 h-11 text-sm outline-none" style={{ background: C.white, border: `1px solid ${C.border}`, color: C.navy }} />
    </div>
  );
}
function Toggle({ label, on, onToggle }) {
  const C = useC();
  return (
    <button onClick={onToggle} className="px-2.5 py-2 rounded-lg text-[11px] font-bold"
      style={{ background: on ? C.primary : C.white, color: on ? "#fff" : C.navy, border: `1px solid ${on ? C.primary : C.border}` }}>
      {label}
    </button>
  );
}
