import React, { useState } from "react";
import { useApp, useC } from "../store/AppContext.jsx";
import { Logo } from "../components/shared/Logo.jsx";
import { PillButton } from "../components/shared/ui.jsx";
import { Icon } from "../components/shared/Icon.jsx";
import { TONE } from "../theme.js";

/* Shown instead of the admin console to anyone who isn't an administrator.
   • Signed out  → an email/mobile + password form right here, so /admin is a real entry point.
   • Signed in but not an admin → "Access restricted", with a way to switch accounts.
   Deliberately generic: it doesn't describe what lives here. Once the account holds the `admin` role the session
   updates and App.jsx swaps this screen for the console by itself — nothing to navigate to. The API still
   re-checks the role on every admin request; this screen is only the front door. */
export default function AdminGate({ signedIn, nav }) {
  const C = useC();
  const { auth, toast } = useApp();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    if (!identifier.trim() || !password) { setError("Enter your email or mobile number and your password."); return; }
    setError("");
    setBusy(true);
    try {
      const user = await auth.login({ identifier: identifier.trim(), password });
      // An admin's session flips this screen to the console on its own; anyone else lands on "Access restricted".
      if (!(user?.roles || []).includes("admin")) toast("This account isn't an administrator", "danger");
    } catch (err) {
      setError(err.code === "INVALID_CREDENTIALS" ? "Incorrect email/mobile or password." : err.message || "Couldn't sign in. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const input = { background: C.white, border: `1px solid ${error ? TONE.danger : C.border}`, color: C.navy };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: C.bg }}>
      <div className="mb-8"><Logo /></div>
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: C.mint }}>
        <Icon name="ShieldCheck" size={24} style={{ color: C.primary }} />
      </div>

      {signedIn ? (
        <>
          <h1 className="font-extrabold text-xl" style={{ color: C.navy }}>Access restricted</h1>
          <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>This area is restricted to authorised administrators.</p>
          <div className="flex flex-col sm:flex-row gap-3 mt-6">
            <PillButton onClick={() => nav("home")}>Back to shopping</PillButton>
            <PillButton variant="subtle" onClick={() => auth.logout()}>Sign in with a different account</PillButton>
          </div>
        </>
      ) : (
        <>
          <h1 className="font-extrabold text-xl" style={{ color: C.navy }}>Administrator sign in</h1>
          <p className="text-sm mt-2 max-w-sm" style={{ color: C.muted }}>Sign in with an administrator account to continue.</p>
          <form onSubmit={submit} className="w-full max-w-sm mt-6 space-y-4 text-left">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Email or mobile number</label>
              <input value={identifier} onChange={(e) => { setIdentifier(e.target.value); setError(""); }} autoComplete="username" autoFocus
                placeholder="you@example.com" className="w-full mt-1 rounded-xl px-3 h-12 text-sm outline-none" style={input} />
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>Password</label>
              <input value={password} onChange={(e) => { setPassword(e.target.value); setError(""); }} type="password" autoComplete="current-password"
                placeholder="••••••••" className="w-full mt-1 rounded-xl px-3 h-12 text-sm outline-none" style={input} />
              {error && <p role="alert" className="text-[11px] font-semibold mt-1" style={{ color: TONE.danger }}>{error}</p>}
            </div>
            <PillButton full size="lg" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</PillButton>
            <button type="button" onClick={() => nav("home")} className="w-full text-center text-sm font-bold" style={{ color: C.primary }}>Back to shopping</button>
          </form>
        </>
      )}
    </div>
  );
}
