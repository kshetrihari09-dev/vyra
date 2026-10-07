import React, { useCallback, useEffect, useRef, useState } from "react";
import { useC } from "../../store/AppContext.jsx";
import { addressesApi } from "../../services/api/addressesApi.js";
import { InlineNotice, PillButton, Spinner } from "./ui.jsx";
import { OtpStep } from "./OtpStep.jsx";

/**
 * Confirms a delivery phone number that is not the customer's login number. Texts a code to THAT number (the server
 * decides — if the number was already confirmed it says so and no text is sent) and calls onVerified() once it is
 * confirmed. The check is enforced by the server on save and on checkout; this is just the screen for it.
 */
export function PhoneVerify({ phone, onVerified, onCancel }) {
  const C = useC();
  const [challenge, setChallenge] = useState(null);
  const [error, setError] = useState("");
  const started = useRef(false);

  const request = useCallback(async () => {
    const data = await addressesApi.startPhone(phone);
    if (data.verified) { onVerified(); return data; }
    setChallenge({ id: data.challengeId, devHint: !!data.devHint });
    return data;
  }, [phone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    request().catch((err) => setError(err.message || "Couldn't send the code. Try again."));
  }, [request]);

  const verify = async (code) => {
    await addressesApi.verifyPhone({ challengeId: challenge.id, code }); // throws with the server's message on a wrong/expired code
    onVerified();
  };

  if (error) {
    return (
      <div className="space-y-3">
        <InlineNotice tone="danger">{error}</InlineNotice>
        <PillButton full variant="outline" onClick={onCancel}>Back to the address</PillButton>
      </div>
    );
  }
  if (!challenge) {
    return <div className="flex flex-col items-center gap-3 py-10" aria-busy="true"><Spinner size={22} /><p className="text-sm" style={{ color: C.muted }}>Sending a code to {phone}…</p></div>;
  }
  return (
    <div>
      <p className="text-xs text-center mb-4" style={{ color: C.muted }}>This isn't your login number, so we confirm it before a rider can be given it.</p>
      <OtpStep target={phone} devHint={challenge.devHint} onVerify={verify} onResend={request} onChangeNumber={onCancel} />
    </div>
  );
}
