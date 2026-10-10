import React, { useEffect, useState } from "react";
import { OPS } from "./posTheme.js";

/** A quantity box that never holds an invalid number: the cashier types freely (even clears it), and only a valid whole number is committed on
    Enter/blur — anything else (0, empty, text) snaps back to the line's real quantity. Esc cancels the edit. */
export function QtyInput({ value, onCommit, disabled, label }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => { setDraft(String(value)); }, [value]);
  const commit = () => { if (draft === String(value)) return; if (onCommit(draft) === "invalid") setDraft(String(value)); };
  return (
    <input value={draft} disabled={disabled} inputMode="numeric" pattern="[0-9]*" aria-label={label}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, "").slice(0, 5))}
      onFocus={(e) => e.target.select()} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); }
        else if (e.key === "Escape") { e.stopPropagation(); setDraft(String(value)); e.currentTarget.blur(); }
      }}
      className="w-11 text-center text-sm font-bold outline-none rounded h-7 disabled:opacity-50" style={{ background: OPS.bg, color: OPS.ink }} />
  );
}
