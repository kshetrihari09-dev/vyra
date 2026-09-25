import { useC } from "../../store/AppContext.jsx";
import { TONE } from "../../theme.js";

/* Seller surface tokens. Brand colours (primary / navy) come from the shared
   theme so the two products stay recognisably Vyra; everything structural —
   neutral canvas, hairline borders, tight radii — is the seller's own. */
export function useS() {
  const C = useC();
  return {
    C,
    canvas: "#F3F5F7",
    panel: "#FFFFFF",
    line: "#E2E7EB",
    lineSoft: "#EEF1F4",
    text: TONE.ink,
    muted: "#5E6E78",
    faint: "#8C9AA3",
    accent: C.primary,
    accentSoft: C.mint,
    side: C.navy,
    r: 8,      // controls
    rPanel: 10, // panels
  };
}

export const TONES = {
  ok: { bg: TONE.okBg, fg: TONE.ok },
  warn: { bg: TONE.warnBg, fg: "#9A6B0B" },
  danger: { bg: TONE.dangerBg, fg: TONE.danger },
  info: { bg: TONE.infoBg, fg: TONE.info },
  neutral: { bg: "#EEF1F4", fg: "#4A5F6B" },
};
