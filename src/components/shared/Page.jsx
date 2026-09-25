import React from "react";

/** Consistent page container: full-bleed on mobile, centred on desktop. */
export function Page({ children, className = "", wide }) {
  return (
    <main className={`pt-4 pb-28 md:pb-16 mx-auto ${wide ? "max-w-7xl" : "max-w-5xl"} md:px-8 ${className}`}>
      {children}
    </main>
  );
}
