import React, { useEffect } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, EmptyState } from "../../components/shared/ui.jsx";
import { NotificationItem } from "../components/NotificationPanel.jsx";
import { BellOff } from "../../components/shared/Icon.jsx";

export default function Notifications({ nav }) {
  const { notifications, myOrders: orders, dispatch } = useApp();
  const unread = notifications.filter((n) => n.unread).length;
  useEffect(() => { const t = setTimeout(() => dispatch({ type: "NOTIFY_READ" }), 1200); return () => clearTimeout(t); }, []);

  const route = (n) => {
    if (["order", "delivery"].includes(n.kind) && orders[0]) nav("orderDetails", { orderId: orders[0].id });
    else if (n.kind === "prescription") nav("prescription");
    else if (["promo", "price"].includes(n.kind)) nav("offers");
    else nav("wishlist");
  };

  return (
    <Page>
      <PageHeader title="Notifications" subtitle={unread ? `${unread} unread` : "All caught up"} onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-3">
        {notifications.length === 0 ? (
          <EmptyState icon={BellOff} title="No notifications yet" message="Order updates and offers will show up here." />
        ) : notifications.map((n) => <NotificationItem key={n.id} notification={n} onClick={() => route(n)} />)}
      </div>
    </Page>
  );
}
