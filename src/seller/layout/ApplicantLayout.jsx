import React from "react";
import { useC } from "../../store/AppContext.jsx";
import { Logo } from "../../components/shared/Logo.jsx";
import { Icon } from "../../components/shared/Icon.jsx";

/* Shop registration / application status. The shop doesn't exist yet, so this
   is neither the dashboard nor the storefront — just a quiet header. */
export default function ApplicantLayout({ nav, children }) {
  const C = useC();
  return (
    <div className="min-h-screen" style={{ background: C.bg }}>
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 h-14" style={{ background: C.white, borderBottom: `1px solid ${C.border}`, paddingTop: "env(safe-area-inset-top)" }}>
        <Logo withTagline={false} />
        <button type="button" onClick={() => nav("home")} className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: C.primary }}>
          <Icon name="ShoppingCart" size={15} /> Back to shopping
        </button>
      </header>
      {children}
    </div>
  );
}
