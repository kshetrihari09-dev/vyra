import React from "react";

/** Consistent page container: full-bleed on mobile, full available width (with side padding) on desktop.
 *  The old `wide` prop only chose between two max-widths, so it no longer has an effect; callers can keep passing it. */
export function Page({ children, className = "" }) {
  return (
    <main className={`pt-4 pb-28 md:pb-16 w-full md:px-8 ${className}`}>
      {children}
    </main>
  );
}
