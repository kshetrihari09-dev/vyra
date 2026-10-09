import React, { useState } from "react";
import { useC } from "../store/AppContext.jsx";
import { Sheet } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";
import { useWorkspaces } from "./useWorkspaces.js";
import { WORKSPACES } from "../services/workspaces.js";

/**
 * Global workspace switcher. Renders nothing unless the account has more than one workspace, and lists only the ones it is
 * authorised for. Switching is just navigation to that workspace's home — the same session, no second sign-in.
 * Compact = an icon chip (label appears from the `sm` breakpoint), so it fits next to the existing header buttons on a phone.
 * Opens the shared Sheet: a bottom sheet on phones, a centred panel on desktop.
 */
export function WorkspaceSwitcher({ nav, view, compact = false }) {
  const C = useC();
  const ws = useWorkspaces(nav, view);
  const [open, setOpen] = useState(false);
  if (!ws.multiple) return null;
  const cur = WORKSPACES[ws.current] || null;

  const pick = (id) => { setOpen(false); if (id !== ws.current) ws.go(id); };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}
        aria-label={`Switch workspace${cur ? ` (current: ${cur.label})` : ""}`}
        className={`inline-flex items-center gap-1.5 rounded-full shrink-0 font-bold text-xs ${compact ? "h-9 px-2.5 sm:px-3" : "h-10 px-3.5"}`}
        style={{ background: C.mint, color: C.primary }}>
        <Icon name={cur?.icon || "LayoutDashboard"} size={15} />
        <span className={compact ? "hidden sm:inline" : ""}>{cur?.label || "Workspace"}</span>
        <Icon name="ChevronDown" size={13} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title="Switch workspace"
        footer={<button type="button" onClick={() => { setOpen(false); nav("workspaces"); }} className="w-full text-center text-sm font-bold py-1" style={{ color: C.primary }}>All workspaces</button>}>
        <ul className="space-y-2" role="list">
          {ws.items.map((w) => {
            const here = w.id === ws.current;
            return (
              <li key={w.id}>
                <button type="button" onClick={() => pick(w.id)} aria-current={here ? "true" : undefined}
                  className="w-full flex items-center gap-3 p-3.5 rounded-2xl text-left"
                  style={{ background: C.white, border: `1.5px solid ${here ? C.primary : C.border}` }}>
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: here ? C.primary : C.navy }}>
                    <Icon name={w.icon} size={17} color="#fff" />
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block font-bold text-sm" style={{ color: C.navy }}>{w.label}</span>
                    <span className="block text-xs truncate" style={{ color: C.muted }}>{w.sub}</span>
                  </span>
                  {here && <Icon name="Check" size={17} style={{ color: C.primary }} />}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>
    </>
  );
}
