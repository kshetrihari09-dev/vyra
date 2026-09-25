import React from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Logo } from "../../components/shared/Logo.jsx";
import { PillButton } from "../../components/shared/ui.jsx";
import { Icon } from "../../components/shared/Icon.jsx";

/* Shown instead of the dashboard when the current account can't use it. It
   deliberately has no navigation of its own — not the seller sidebar and not
   the customer tab bar — so nothing about either app leaks through. */
export default function ShopGate({ reason, seller, nav }) {
  const C = useC();
  const { shopApplications, session } = useApp();
  const app = shopApplications.find((a) => a.owner.mobile === session.user.phone);

  const copy = {
    not_shop_owner: {
      icon: "Store", title: "This area is for shop owners",
      body: app ? "Your shop application hasn't been approved yet. You'll get access to the shop dashboard as soon as it is." : "You're signed in as a customer. Register a shop to start selling on Vyra.",
    },
    pending: { icon: "Clock", title: `${seller?.name || "Your shop"} is awaiting approval`, body: "Listings and orders open up as soon as an administrator approves the shop." },
    suspended: { icon: "AlertTriangle", title: `${seller?.name || "This shop"} is suspended`, body: "Selling is paused while the suspension is in place. Contact Vyra support to resolve it." },
    inactive: { icon: "AlertTriangle", title: `${seller?.name || "This shop"} is not active`, body: "Contact Vyra support to reactivate it." },
  }[reason] || {};

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: C.bg }}>
      <div className="mb-8"><Logo /></div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.mint }}>
        <Icon name={copy.icon || "Store"} size={24} style={{ color: C.primary }} />
      </div>
      <h1 className="font-extrabold text-xl" style={{ color: C.navy }}>{copy.title}</h1>
      <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>{copy.body}</p>
      <div className="flex flex-col sm:flex-row gap-3 mt-6">
        <PillButton onClick={() => nav("home")}>Back to shopping</PillButton>
        {reason === "not_shop_owner" && (
          <PillButton variant="outline" onClick={() => nav(app ? "shopStatus" : "shopOnboarding", app ? { applicationId: app.id } : {})}>
            {app ? "View my application" : "Register your shop"}
          </PillButton>
        )}
      </div>
    </div>
  );
}
