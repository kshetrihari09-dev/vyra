import React from "react";
import { relativeTime } from "../../utils/format.js";
import { useC } from "../../store/AppContext.jsx";
import { Icon } from "../../components/shared/Icon.jsx";
import { TONE } from "../../theme.js";

const KIND = {
  order: { icon: "Package", tone: "info" },
  delivery: { icon: "Truck", tone: "info" },
  payment: { icon: "CreditCard", tone: "ok" },
  prescription: { icon: "FileText", tone: "ok" },
  promo: { icon: "Percent", tone: "warn" },
  price: { icon: "TrendingUp", tone: "warn" },
  stock: { icon: "PackageCheck", tone: "ok" },
};

/** One component for every notification type — new kinds need only a data entry. */
export function NotificationItem({ notification, onClick }) {
  const C = useC();
  const meta = KIND[notification.kind] || KIND.order;
  const toneBg = { info: TONE.infoBg, ok: TONE.okBg, warn: TONE.warnBg }[meta.tone];
  const toneFg = { info: TONE.info, ok: TONE.ok, warn: TONE.warn }[meta.tone];
  return (
    <button onClick={onClick} className="w-full text-left rounded-2xl p-4 flex items-start gap-3"
      style={{ background: notification.unread ? C.mint : C.white, border: `1px solid ${notification.unread ? C.primary + "33" : C.border}` }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: toneBg }}>
        <Icon name={meta.icon} size={17} style={{ color: toneFg }} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-bold text-sm" style={{ color: C.navy }}>{notification.title}</span>
          {notification.unread && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: TONE.danger }} />}
        </span>
        <span className="block text-sm mt-0.5 leading-snug" style={{ color: C.muted }}>{notification.message}</span>
        <span className="block text-[11px] mt-1.5" style={{ color: C.muted }}>{relativeTime(notification.createdAt)}</span>
      </span>
    </button>
  );
}
