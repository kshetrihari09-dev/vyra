import React from "react";
import { useC } from "../store/AppContext.jsx";
import { Page } from "../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";

/* Shown instead of the delivery app to anyone without the rider permission (a deep link, a stale bookmark, a rider whose
   access was just removed). A front door only — every rider API call re-checks the account on the server. */
export default function RiderRestricted({ nav }) {
  const C = useC();
  return (
    <Page>
      <PageHeader title="Delivery App" onBack={() => nav("profile")} />
      <div className="p-6 flex flex-col items-center text-center gap-3" role="alert">
        <span className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: C.navy }}><Icon name="Bike" size={24} color="#fff" /></span>
        <p className="font-bold" style={{ color: C.text }}>Delivery access isn't enabled for this account</p>
        <p className="text-sm" style={{ color: C.muted }}>Ask an administrator to set you up as a delivery rider, then sign in again.</p>
        <PillButton onClick={() => nav("profile")}>Back to account</PillButton>
      </div>
    </Page>
  );
}
