/* Design tokens — preserved from the original Vyra palette. */
export const THEMES = {
  teal:   { label: "Teal",   primary: "#0FAF8F", primaryDark: "#0C9B7E", navy: "#063F50", mint: "#E9FAF6", bg: "#F8FCFB", white: "#FFFFFF", muted: "#71838C", border: "#E5F0EE", success: "#0FAF8F" },
  ocean:  { label: "Ocean",  primary: "#1E88C7", primaryDark: "#1670A3", navy: "#0B2B45", mint: "#E7F2FC", bg: "#F7FAFD", white: "#FFFFFF", muted: "#71828F", border: "#DCEAF6", success: "#1E88C7" },
  coral:  { label: "Coral",  primary: "#F0725A", primaryDark: "#D65D46", navy: "#432A24", mint: "#FDECE6", bg: "#FDFAF8", white: "#FFFFFF", muted: "#8A7570", border: "#F6E2DA", success: "#F0725A" },
  violet: { label: "Violet", primary: "#7C5CD6", primaryDark: "#6647BE", navy: "#241B42", mint: "#F1ECFC", bg: "#FAF9FD", white: "#FFFFFF", muted: "#7E7690", border: "#EAE3F8", success: "#7C5CD6" },
};
export const THEME_ORDER = ["teal", "ocean", "coral", "violet"];

/* Semantic colors that do not change with the theme. */
export const TONE = {
  danger: "#E0546A", dangerBg: "#FCEAEC",
  warn: "#E0A427", warnBg: "#FCF3E3",
  info: "#2B6CB0", infoBg: "#E7F0FC",
  ok: "#128C6C", okBg: "#E6F7F1",
  ink: "#1C2B33",
};
