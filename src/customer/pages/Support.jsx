import React, { useCallback, useEffect, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, Badge, InlineNotice } from "../../components/shared/ui.jsx";
import { Icon, ChevronRight, MessageCircle, Phone, Mail, Stethoscope, AlertTriangle } from "../../components/shared/Icon.jsx";
import { supportApi } from "../../services/api/supportApi.js";
import { chatAvailability, telHref } from "../../support/supportLogic.js";
import PharmacistChat from "../components/PharmacistChat.jsx";
import SupportMessageSheet from "../components/SupportMessageSheet.jsx";
import CallSheet from "../components/CallSheet.jsx";
import { TONE } from "../../theme.js";

const TOPICS = [
  { id: "order", label: "Order support", sub: "Late, missing or wrong items", icon: "Package" },
  { id: "payment", label: "Payment support", sub: "Charges, refunds and receipts", icon: "CreditCard" },
  { id: "delivery", label: "Delivery support", sub: "Address, rider or OTP problems", icon: "Truck" },
  { id: "product", label: "Product question", sub: "Specs, usage and availability", icon: "Info" },
  { id: "return", label: "Return or refund", sub: "Start a return within 7 days", icon: "RotateCcw" },
  { id: "contact", label: "Contact support", sub: "Email our support team", icon: "Headphones" },
];
const REFRESH_MS = 30_000;
const isTouch = () => typeof window !== "undefined" && !!window.matchMedia?.("(pointer: coarse)").matches;

/**
 * Help & Support. Every action here is real or honestly unavailable:
 *  - Live chat opens the pharmacist conversation (offline status shown as it is, never a fake "online").
 *  - Call uses the configured pharmacy/store number as a tel: link (copy on desktop) and is disabled when no number exists.
 *  - Email / the topic forms go through the backend and only say "delivered" when the email provider accepted it.
 */
export default function Support({ nav, params }) {
  const { myOrders: orders, storeId, session } = useApp();
  const C = useC();
  const order = params.orderId ? orders.find((o) => o.id === params.orderId) : null;
  const refs = { orderId: params.orderId, productId: params.productId, prescriptionId: params.prescriptionId };

  const [contact, setContact] = useState(null);
  const [contactError, setContactError] = useState(false);
  const [sheet, setSheet] = useState(params.topic === "pharmacist" ? "pharmacist" : params.open === "chat" ? "chat" : TOPICS.some((t) => t.id === params.topic) ? params.topic : null);

  const loadContact = useCallback(async () => {
    try { setContact(await supportApi.contact(storeId)); setContactError(false); }
    catch { setContactError(true); }
  }, [storeId, session.signedIn]); // eslint-disable-line react-hooks/exhaustive-deps

  // The availability shown here is read from the server and refreshed, so it can't go stale while the page stays open.
  useEffect(() => {
    loadContact();
    const t = setInterval(() => { if (!document.hidden) loadContact(); }, REFRESH_MS);
    return () => clearInterval(t);
  }, [loadContact]);

  const signIn = () => nav("welcome", { next: window.location.pathname + window.location.search });
  const close = () => { setSheet(null); loadContact(); };
  const openChat = () => (session.signedIn ? setSheet("chat") : signIn());
  const openEmail = () => setSheet("pharmacist");

  const avail = chatAvailability({ signedIn: session.signedIn, contact, error: contactError });
  const phone = contact?.phone ?? null;
  const tel = telHref(phone?.tel);
  const emailCap = contact?.email.pharmacy;
  const unread = contact?.unread || 0;

  const card = { background: C.white, border: `1px solid ${C.border}` };
  const cardInner = (Ico, label, detail, tone) => (
    <>
      <Ico size={18} style={{ color: tone === "off" ? "#9AAAB2" : C.primary }} className="mx-auto mb-1.5" />
      <p className="text-xs font-bold" style={{ color: C.navy }}>{label}</p>
      <p className="text-[10px] leading-tight break-words" style={{ color: tone === "ok" ? TONE.ok : C.muted }}>{detail}</p>
    </>
  );

  const sheetTopic = sheet && sheet !== "chat" && sheet !== "call" ? sheet : null;
  const topicTitle = sheetTopic === "pharmacist" ? "Email a Pharmacist" : TOPICS.find((t) => t.id === sheetTopic)?.label || "Support";

  return (
    <Page>
      <PageHeader title="Help & Support" subtitle={order ? `About ${order.number}` : "Chat, call or email our team"} onBack={() => nav("profile")} />

      <div className="px-4 md:px-0 space-y-4">
        {/* Pharmacist is a separate, healthcare-only channel */}
        <button onClick={openEmail} className="w-full rounded-2xl p-4 flex items-center gap-3 text-left" style={{ background: C.navy }} aria-label="Talk to a pharmacist: send a message">
          <span className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: "rgba(255,255,255,.16)" }}>
            <Stethoscope size={19} color="#fff" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-bold text-sm text-white">Talk to a Pharmacist</span>
            <span className="block text-xs text-white/70" role="status">
              {avail.tone === "ok" ? "A pharmacist is online now" : contact && !contactError ? "No pharmacist online right now · you can message or call" : avail.label}
            </span>
          </span>
          {unread > 0 && <Badge tone="danger">{unread} new</Badge>}
          <ChevronRight size={18} color="#fff" />
        </button>

        <div className="rounded-2xl overflow-hidden" style={card}>
          {TOPICS.map((t, i) => (
            <button key={t.id} onClick={() => setSheet(t.id)} className="w-full flex items-center gap-3 p-4 text-left" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                <Icon name={t.icon} size={17} style={{ color: C.primary }} />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold text-sm" style={{ color: C.navy }}>{t.label}</span>
                <span className="block text-xs truncate" style={{ color: C.muted }}>{t.sub}</span>
              </span>
              <ChevronRight size={17} style={{ color: C.muted }} />
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: C.muted }}>Contact a pharmacist</p>
          <div className="grid grid-cols-3 gap-2.5">
            <button onClick={openChat} className="rounded-2xl p-3 text-center relative" style={card} aria-label={`Live chat with a pharmacist. ${avail.label}`}>
              {unread > 0 && <span className="absolute top-2 right-2 w-2.5 h-2.5 rounded-full" style={{ background: TONE.danger }} aria-label={`${unread} unread`} />}
              {cardInner(MessageCircle, "Live chat", avail.label, avail.tone)}
            </button>

            {tel && isTouch() ? (
              <a href={tel} className="rounded-2xl p-3 text-center block" style={card} aria-label={`Call the pharmacy on ${phone.display}`}>
                {cardInner(Phone, "Call", phone.display, "muted")}
              </a>
            ) : (
              <button onClick={() => setSheet("call")} disabled={!tel} aria-disabled={!tel} className="rounded-2xl p-3 text-center disabled:opacity-60 disabled:cursor-not-allowed" style={card}
                aria-label={tel ? `Call the pharmacy on ${phone.display}` : "Calling is unavailable"}>
                {cardInner(Phone, "Call", !contact && !contactError ? "Checking…" : tel ? phone.display : "Unavailable", tel ? "muted" : "off")}
              </button>
            )}

            <button onClick={openEmail} className="rounded-2xl p-3 text-center" style={card} aria-label="Email a pharmacist">
              {cardInner(Mail, "Email", !contact ? "Checking…" : emailCap?.canSend ? "Message a pharmacist" : emailCap?.address ? "Use your email app" : "Unavailable", emailCap?.canSend ? "muted" : "off")}
            </button>
          </div>
          {contact && !tel && (
            <p className="text-xs mt-2" style={{ color: C.muted }}>Calling is unavailable right now — no pharmacy phone number has been set up.</p>
          )}
          {contactError && (
            <div className="mt-2"><InlineNotice tone="warn" icon={AlertTriangle}>We couldn't check pharmacist availability. Check your connection — the page will keep retrying.</InlineNotice></div>
          )}
        </div>
      </div>

      <PharmacistChat open={sheet === "chat"} onClose={close} refs={refs} onEmail={() => setSheet("pharmacist")} />
      <CallSheet open={sheet === "call"} onClose={close} phone={phone} />
      <SupportMessageSheet open={!!sheetTopic} onClose={close} topic={sheetTopic || "pharmacist"} title={topicTitle} contact={contact}
        refs={refs} onOpenChat={openChat} onSignIn={signIn} />
    </Page>
  );
}
