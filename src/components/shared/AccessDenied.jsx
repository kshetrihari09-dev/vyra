import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Logo } from "./Logo.jsx";
import { PillButton } from "./ui.jsx";
import { Icon } from "./Icon.jsx";
import { ownedSellerId } from "../../services/access.js";
import { resolveDestination } from "../../services/workspaces.js";

/* Front door shown instead of a console the signed-in account has no permission for (a typed URL, a stale bookmark, a role that was
   just removed). Deliberately generic. The API re-checks the permission on every request; this only keeps the screen honest.
   "Go to my workspace" uses the same single resolver as sign-in, ignoring any remembered screen, so it can never lead back here. */
export default function AccessDenied({ nav, title = "Access restricted", body = "Your account doesn't have access to this area." }) {
  const C = useC();
  const { session, shopApplications } = useApp();
  const home = resolveDestination({ principal: session, userId: session.user.uuid, ownsShop: !!ownedSellerId(session, shopApplications) });
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: C.bg }} role="alert">
      <div className="mb-8"><Logo /></div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.mint }}><Icon name="ShieldCheck" size={24} style={{ color: C.primary }} /></div>
      <h1 className="font-extrabold text-xl" style={{ color: C.navy }}>{title}</h1>
      <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>{body}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <PillButton onClick={() => nav(home.view, home.params)}>Go to my workspace</PillButton>
        <PillButton variant="subtle" onClick={() => nav("home")}>Back to shopping</PillButton>
      </div>
    </div>
  );
}
