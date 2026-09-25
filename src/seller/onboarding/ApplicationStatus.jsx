import React, { useMemo } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../../customer/layout/CustomerLayout.jsx";
import { PageHeader, PillButton, Badge, InlineNotice, EmptyState, Divider } from "../../components/shared/ui.jsx";
import { Check, X, Clock, PartyPopper, FileText, AlertTriangle } from "../../components/shared/Icon.jsx";
import { applicationChecklist } from "../../utils/shopApplication.js";
import { dateTimeLabel } from "../../utils/format.js";
import { TONE } from "../../theme.js";

const LABELS = { owner: "Owner Information", shop: "Shop Information", business: "Business Information", documents: "Documents", operations: "Operations", settlement: "Settlement", verification: "Admin Verification" };

export default function ShopApplicationStatus({ nav, params }) {
  const { shopApplications, session } = useApp();
  const C = useC();

  const app = useMemo(() => {
    if (params?.applicationId) return shopApplications.find((a) => a.id === params.applicationId);
    return shopApplications.find((a) => a.owner.mobile === session.user.phone) || null;
  }, [shopApplications, params, session]);

  if (!app) {
    return (
      <Page>
        <PageHeader title="Shop Application" onBack={() => nav("profile")} />
        <EmptyState icon={FileText} title="No application found" message="Start a new shop registration to see its status here." action="Register Your Shop" onAction={() => nav("shopOnboarding")} />
      </Page>
    );
  }

  const checklist = applicationChecklist(app);

  return (
    <Page>
      <PageHeader title="Shop Registration" subtitle={app.shop.name} onBack={() => nav("profile")} />
      <div className="px-4 md:px-0 space-y-4 max-w-xl">
        <div className="rounded-2xl overflow-hidden" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          {checklist.map((c, i) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.border}` : "none" }}>
              <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                style={{ background: c.done ? TONE.okBg : c.pending ? TONE.warnBg : C.bg }}>
                {c.done ? <Check size={13} style={{ color: TONE.ok }} /> : c.pending ? <Clock size={12} style={{ color: TONE.warn }} /> : <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.muted }} />}
              </span>
              <span className="text-sm font-semibold flex-1" style={{ color: C.navy }}>{LABELS[c.id]}</span>
            </div>
          ))}
        </div>

        <StatusBanner app={app} nav={nav} />

        <div className="rounded-2xl p-4" style={{ background: C.white, border: `1px solid ${C.border}` }}>
          <p className="font-extrabold text-sm mb-3" style={{ color: C.navy }}>Application history</p>
          {app.history.slice().reverse().map((h, i) => (
            <div key={i} className="flex gap-2.5 pb-3 last:pb-0">
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: C.primary }} />
              <div>
                <p className="text-xs font-bold capitalize" style={{ color: C.navy }}>{h.status.replace("_", " ")}</p>
                <p className="text-[11px]" style={{ color: C.muted }}>{h.note} · {h.actor} · {dateTimeLabel(h.at)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

function StatusBanner({ app, nav }) {
  const C = useC();
  if (app.status === "draft") {
    return (
      <InlineNotice tone="info">
        Your application is saved as a draft. <button onClick={() => nav("shopOnboarding", { applicationId: app.id })} className="font-bold underline">Continue application</button>
      </InlineNotice>
    );
  }
  if (["submitted", "under_review"].includes(app.status)) {
    return <InlineNotice tone="warn" icon={Clock}>Status: Under Review. We'll notify you as soon as an admin has verified your documents.</InlineNotice>;
  }
  if (app.status === "approved") {
    return (
      <div className="rounded-2xl p-5 text-center" style={{ background: TONE.okBg }}>
        <PartyPopper size={28} style={{ color: TONE.ok }} className="mx-auto mb-2" />
        <p className="font-extrabold text-base" style={{ color: TONE.ok }}>Congratulations!</p>
        <p className="text-sm mt-1" style={{ color: TONE.ok }}>Your shop has been approved and is now live on Vyra.</p>
        <PillButton className="mt-4" onClick={() => nav("shopDashboard")}>Go to Shop Dashboard</PillButton>
      </div>
    );
  }
  if (app.status === "rejected") {
    return (
      <div className="rounded-2xl p-4" style={{ background: TONE.dangerBg }}>
        <div className="flex items-center gap-2 mb-1.5">
          <AlertTriangle size={16} style={{ color: TONE.danger }} />
          <p className="font-extrabold text-sm" style={{ color: TONE.danger }}>{app.needsCorrection ? "Changes requested" : "Application Rejected"}</p>
        </div>
        <p className="text-sm mb-4" style={{ color: TONE.danger }}>{app.rejectionReason || "No reason was provided."}</p>
        <PillButton onClick={() => nav("shopOnboarding", { applicationId: app.id })}>Edit Application</PillButton>
      </div>
    );
  }
  if (app.status === "suspended") {
    return <InlineNotice tone="danger" icon={X}>Your shop has been suspended. Contact support for details.</InlineNotice>;
  }
  return null;
}
