import React, { useEffect, useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { PillButton, Spinner } from "./ui.jsx";
import { isOtp } from "../../utils/validation.js";
import { TONE } from "../../theme.js";

/** Only shown when the server says it is running with a fixed development OTP (never in production). */
const DEV_OTP = "1234";

/**
 * One OTP flow reused everywhere a mobile number needs verifying — customer
 * registration and the shop-owner account step both use this, so there is
 * exactly one OTP implementation in the app, not two parallel ones.
 *
 * The code is checked by the server: `onVerify(code)` should call the API and throw on a wrong/expired
 * code (the thrown message is shown under the input). `onResend()` asks the server for a fresh code.
 */
export function OtpStep({ target, onVerify, onResend, onChangeNumber, devHint = false }) {
  const { toast } = useApp();
  const C = useC();
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [seconds, setSeconds] = useState(60);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const resend = async () => {
    if (seconds > 0 || !onResend) return;
    try {
      await onResend();
      setSeconds(60);
      setOtp("");
      setError("");
      toast(`New code sent to ${target}`);
    } catch (err) {
      setError(err.message || "Couldn't send a new code. Try again.");
    }
  };

  const verify = async () => {
    if (!isOtp(otp)) { setError("Enter the 4-digit code"); return; }
    setBusy(true);
    setError("");
    try {
      await onVerify(otp);
    } catch (err) {
      setError(err.message || "Couldn't verify that code. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="font-extrabold text-xl text-center" style={{ color: C.navy }}>Enter the code</h2>
      <p className="text-sm text-center mt-1 mb-6" style={{ color: C.muted }}>
        Sent to <span className="font-semibold" style={{ color: C.navy }}>{target}</span>.{devHint && <> Development mode: use <span className="font-bold">{DEV_OTP}</span>.</>}
      </p>
      <input value={otp} onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }}
        inputMode="numeric" placeholder="0000" aria-label="Verification code"
        className="w-full text-center tracking-[0.5em] font-extrabold text-2xl rounded-2xl h-16 outline-none"
        style={{ background: C.white, border: `1.5px solid ${error ? TONE.danger : C.border}`, color: C.navy }} />
      {error && <p className="text-xs mt-2 font-semibold text-center" style={{ color: TONE.danger }}>{error}</p>}

      <PillButton full size="lg" className="mt-5" onClick={verify} disabled={busy}>
        {busy ? <Spinner size={16} /> : "Verify and continue"}
      </PillButton>

      <div className="flex items-center justify-center gap-1.5 mt-4 text-sm">
        <span style={{ color: C.muted }}>Didn't get a code?</span>
        <button onClick={resend} disabled={seconds > 0} className="font-bold disabled:opacity-50" style={{ color: C.primary }}>
          {seconds > 0 ? `Resend in ${seconds}s` : "Resend"}
        </button>
      </div>
      {onChangeNumber && (
        <button onClick={onChangeNumber} className="w-full text-center text-sm font-bold mt-3" style={{ color: C.muted }}>Change number</button>
      )}
    </div>
  );
}
