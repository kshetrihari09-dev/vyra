import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Page } from "../layout/CustomerLayout.jsx";
import { PageHeader, PillButton, EmptyState, Sheet } from "../../components/shared/ui.jsx";
import { AddressCard } from "../components/AddressCard.jsx";
import { AddressForm } from "./Checkout.jsx";
import { MapPin, Plus } from "../../components/shared/Icon.jsx";
import { validateAddress } from "../../utils/validation.js";
import { PhoneVerify } from "../../components/shared/PhoneVerify.jsx";

export default function Addresses({ nav }) {
  const { addresses, commerce, toast, session } = useApp();
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState(false); // confirming a delivery number that isn't the login number

  const save = async () => {
    const v = validateAddress(draft, { requireNepal: true });
    if (!v.ok) { toast(Object.values(v.errors)[0], "danger"); return; }
    setBusy(true);
    try {
      if (draft.id) await commerce.updateAddress(draft);
      else await commerce.createAddress(draft);
      setDraft(null); setVerifying(false);
      toast("Address saved");
    } catch (err) {
      if (err.code === "PHONE_NOT_VERIFIED") setVerifying(true); // the server wants this number confirmed first
      else toast(err.message || "Couldn't save the address", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page>
      <PageHeader title="Addresses" subtitle={`${addresses.length} saved`} onBack={() => nav("profile")}
        right={<PillButton size="sm" onClick={() => setDraft({ label: "Home", name: session.user.name, line1: "", line2: "", city: "", zip: "", phone: session.user.phone, isDefault: false })}><Plus size={14} /> Add</PillButton>} />
      <div className="px-4 md:px-0 space-y-3">
        {addresses.length === 0 ? (
          <EmptyState icon={MapPin} title="No addresses yet" message="Add one so checkout is a single tap." action="Add address" onAction={() => setDraft({ label: "Home", name: session.user.name, line1: "", line2: "", city: "", zip: "", phone: session.user.phone, isDefault: false })} />
        ) : addresses.map((a) => (
          <AddressCard key={a.id} address={a} onEdit={setDraft}
            onMakeDefault={async (id) => { try { await commerce.setDefaultAddress(id); toast("Default address updated"); } catch (err) { toast(err.message || "Couldn't update the default", "danger"); } }}
            onRemove={async (id) => { try { await commerce.removeAddress(id); toast("Address removed"); } catch (err) { toast(err.message || "Couldn't remove the address", "danger"); } }} />
        ))}
      </div>
      <Sheet open={!!draft} onClose={() => { setDraft(null); setVerifying(false); }} title={verifying ? "Confirm phone number" : draft?.id ? "Edit address" : "Add address"}
        footer={verifying ? null : <PillButton full onClick={save} disabled={busy}>{busy ? "Saving…" : "Save address"}</PillButton>}>
        {draft && (verifying
          ? <PhoneVerify phone={draft.phone} onVerified={() => { setVerifying(false); save(); }} onCancel={() => setVerifying(false)} />
          : <AddressForm value={draft} onChange={setDraft} />)}
      </Sheet>
    </Page>
  );
}
