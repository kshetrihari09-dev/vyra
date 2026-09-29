import React, { useEffect, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, EmptyState } from "../../components/shared/ui.jsx";
import { NotificationItem } from "../components/NotificationPanel.jsx";
import { BellOff } from "../../components/shared/Icon.jsx";
import { notificationsApi } from "../../services/api/notificationsApi.js";

export default function Notifications({ nav }) {
  const app = useApp();
  const { notifications, unread } = app;
  const C = useC();
  const [prefs, setPrefs] = useState(null);
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => { app.notifications.reload(); app.notifications.getPreferences().then(setPrefs).catch(() => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const route = async (n) => {
    if (n.unread) app.notifications.markRead(n.id).catch(() => {});
    if (n.data?.orderId) nav("orderDetails", { orderId: n.data.orderId });
    else if (n.data?.prescriptionId) nav("prescription");
    else if (n.data?.applicationId) nav("sellerApplication", { applicationId: n.data.applicationId });
    else if (n.kind === "seller") nav("sellerDashboard");
    else nav("offers");
  };

  const togglePref = async (key) => {
    if (!prefs) return;
    setSavingPrefs(true);
    try { setPrefs(await notificationsApi.setPreferences({ [key]: !prefs[key] })); }
    finally { setSavingPrefs(false); }
  };

  return (
    <Page>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "All caught up"} onBack={() => nav("profile")}
        right={unread > 0 && <button onClick={() => app.notifications.markAllRead()} className="text-xs font-bold" style={{ color: C.primary }}>Mark all read</button>} />
      <div className="px-4 md:px-0 space-y-3">
        {prefs && (
          <div className="rounded-2xl p-4 flex items-center justify-between gap-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
            <div>
              <p className="text-xs font-bold" style={{ color: C.navy }}>Email &amp; SMS alerts</p>
              <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>In-app notifications always show here regardless.</p>
            </div>
            <div className="flex gap-2 shrink-0">
              {["email", "sms"].map((k) => (
                <button key={k} disabled={savingPrefs} onClick={() => togglePref(k)} className="px-3 py-1.5 rounded-full text-[11px] font-bold capitalize"
                  style={{ background: prefs[k] ? C.primary : C.bg, color: prefs[k] ? "#fff" : C.muted, border: `1px solid ${prefs[k] ? C.primary : C.border}` }}>{k} {prefs[k] ? "on" : "off"}</button>
              ))}
            </div>
          </div>
        )}
        {notifications.length === 0 ? (
          <EmptyState icon={BellOff} title="No notifications yet" message="Order updates, deliveries and account alerts will show up here." />
        ) : notifications.map((n) => <NotificationItem key={n.id} notification={n} onClick={() => route(n)} />)}
      </div>
    </Page>
  );
}
