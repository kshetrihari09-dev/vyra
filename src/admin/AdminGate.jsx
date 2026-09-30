import React from "react";
import { useC } from "../store/AppContext.jsx";
import { Logo } from "../components/shared/Logo.jsx";
import { PillButton } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";

/* Shown instead of the admin console to anyone who isn't an administrator. Deliberately generic: it doesn't
   describe what lives here, and has no navigation into the admin area. */
export default function AdminGate({ signedIn, nav }) {
  const C = useC();
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: C.bg }}>
      <div className="mb-8"><Logo /></div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.mint }}>
        <Icon name="ShieldCheck" size={24} style={{ color: C.primary }} />
      </div>
      <h1 className="font-extrabold text-xl" style={{ color: C.navy }}>{signedIn ? "Access restricted" : "Sign in required"}</h1>
      <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>
        {signedIn ? "This area is restricted to authorised administrators." : "Sign in with an administrator account to continue."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <PillButton onClick={() => nav(signedIn ? "home" : "welcome")}>{signedIn ? "Back to shopping" : "Go to sign in"}</PillButton>
      </div>
    </div>
  );
}
