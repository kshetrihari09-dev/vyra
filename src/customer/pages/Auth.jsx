import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Logo } from "../layout/CustomerLayout.jsx";
import { PillButton, InlineNotice } from "../../components/shared/ui.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import { OtpStep } from "../../components/shared/OtpStep.jsx";
import { ArrowRight, ShieldCheck, Truck, Clock, Store, User } from "../../components/shared/Icon.jsx";
import { isEmail, isNepalMobile, validateAccountFields } from "../../utils/validation.js";
import { TONE } from "../../theme.js";

/** Welcome → choose Login / Register as Customer / Register Your Shop.
    Shop registration is its own multi-step route (src/shop/Onboarding.jsx);
    this page only owns the customer account + login paths, reusing the one
    OtpStep component and the one account-validation function everywhere. */
export default function Auth({ nav }) {
  const { auth, toast, products } = useApp();
  const C = useC();
  const [mode, setMode] = useState("welcome"); // welcome | login | register | otp
  const [form, setForm] = useState({ name: "", mobile: "", email: "", password: "", confirmPassword: "" });
  const [errors, setErrors] = useState({});

  const hero = ["cold-brew-coffee", "vitamin-c-serum", "wireless-earbuds", "paracetamol-500"].map((id) => products.find((p) => p.id === id)).filter(Boolean);

  const [challenge, setChallenge] = useState(null); // { id, devHint } from POST /auth/register/start
  const [busy, setBusy] = useState(false);

  const showApiError = (err) => {
    const fields = err.fieldErrors || {};
    if (Object.keys(fields).length) setErrors(fields);
    else toast(err.message, "danger");
  };

  const requestCode = async () => {
    const data = await auth.registerStart({ name: form.name.trim(), mobile: form.mobile, email: form.email.trim(), password: form.password });
    setChallenge({ id: data.challengeId, devHint: !!data.devHint });
  };

  const submitRegister = async () => {
    // Format checks give instant feedback; whether the number/email is already taken is decided by the server.
    const v = validateAccountFields(form, { mobiles: [], emails: [] });
    setErrors(v.errors);
    if (!v.ok) return;
    setBusy(true);
    try {
      await requestCode();
      setMode("otp");
      toast(`Verification code sent to ${form.mobile}`);
    } catch (err) {
      showApiError(err);
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (code) => {
    await auth.registerVerify({ challengeId: challenge.id, code }); // throws with the server's message on a bad code
    toast("Welcome to Vyra");
    nav("home");
  };

  const submitLogin = async () => {
    if (!isNepalMobile(form.mobile) && !isEmail(form.email)) { setErrors({ mobile: "Enter a valid mobile number or email" }); return; }
    if (!form.password) { setErrors({ password: "Enter your password" }); return; }
    setErrors({});
    setBusy(true);
    try {
      await auth.login({ identifier: isNepalMobile(form.mobile) ? form.mobile : form.email.trim(), password: form.password });
      toast("Welcome back");
      nav("home");
    } catch (err) {
      if (err.code === "INVALID_CREDENTIALS") setErrors({ password: err.message });
      else toast(err.message, "danger");
    } finally {
      setBusy(false);
    }
  };

  const field = (key, label, placeholder, type = "text") => (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wide" style={{ color: C.muted }}>{label}</label>
      <input value={form[key]} type={type} onChange={(e) => { setForm({ ...form, [key]: e.target.value }); setErrors({ ...errors, [key]: null }); }} placeholder={placeholder}
        className="w-full mt-1 rounded-xl px-3 h-12 text-sm outline-none"
        style={{ background: C.white, border: `1px solid ${errors[key] ? TONE.danger : C.border}`, color: C.navy }} />
      {errors[key] && <p className="text-[11px] font-semibold mt-1" style={{ color: TONE.danger }}>{errors[key]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col md:items-center md:justify-center px-6 py-10" style={{ background: C.bg }}>
      <div className="w-full max-w-md mx-auto">
        <div className="flex justify-center mb-8"><Logo size="lg" /></div>

        {mode === "welcome" && (
          <>
            <div className="grid grid-cols-2 gap-3 mb-8">
              {hero.map((p) => (
                <div key={p.id} className="rounded-2xl overflow-hidden h-28" style={{ background: C.white, border: `1px solid ${C.border}` }}>
                  <ProductArt product={p} size={72} rounded={false} />
                </div>
              ))}
            </div>
            <h1 className="font-extrabold text-2xl text-center leading-tight" style={{ color: C.navy }}>
              Groceries, beauty, tech and medicine — delivered
            </h1>
            <p className="text-sm text-center mt-2 mb-6" style={{ color: C.muted }}>
              Local shops near you, with pharmacist-checked medicines when you need them.
            </p>
            <div className="space-y-2.5 mb-7">
              {[
                { icon: Clock, text: "Express delivery in as little as 18 minutes" },
                { icon: ShieldCheck, text: "Licensed pharmacy with prescription verification" },
                { icon: Truck, text: "Free delivery on orders over Rs. 25" },
              ].map((f) => (
                <div key={f.text} className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                    <f.icon size={15} style={{ color: C.primary }} />
                  </span>
                  <span className="text-sm" style={{ color: C.navy }}>{f.text}</span>
                </div>
              ))}
            </div>

            <PillButton full size="lg" onClick={() => setMode("login")}>Log in <ArrowRight size={16} /></PillButton>
            <button onClick={() => { setForm({ name: "", mobile: "", email: "", password: "", confirmPassword: "" }); setErrors({}); setMode("register"); }}
              className="w-full rounded-full mt-3 py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: C.mint, color: C.primary }}>
              <User size={16} /> Register as Customer
            </button>
            <button onClick={() => nav("shopOnboarding")}
              className="w-full rounded-full mt-3 py-3.5 text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: C.white, border: `1.5px solid ${C.border}`, color: C.navy }}>
              <Store size={16} /> Register Your Shop
            </button>
            <button onClick={() => nav("home")} className="w-full text-center text-xs mt-4" style={{ color: C.muted }}>Continue as guest</button>
          </>
        )}

        {mode === "login" && (
          <>
            <h1 className="font-extrabold text-xl text-center" style={{ color: C.navy }}>Welcome back</h1>
            <p className="text-sm text-center mt-1 mb-6" style={{ color: C.muted }}>Log in with your mobile number or email.</p>
            <div className="space-y-4">
              {field("mobile", "Mobile number", "98XXXXXXXX", "tel")}
              {field("email", "Email (optional)", "you@example.com", "email")}
              {field("password", "Password", "••••••••", "password")}
              <PillButton full size="lg" onClick={submitLogin} disabled={busy}>Log in</PillButton>
              <button onClick={() => setMode("welcome")} className="w-full text-center text-sm font-bold" style={{ color: C.primary }}>Back</button>
            </div>
          </>
        )}

        {mode === "register" && (
          <>
            <h1 className="font-extrabold text-xl text-center" style={{ color: C.navy }}>Create your account</h1>
            <p className="text-sm text-center mt-1 mb-6" style={{ color: C.muted }}>We'll verify your mobile number with a one-time code.</p>
            <div className="space-y-4">
              {field("name", "Full name", "Sabina Karki")}
              {field("mobile", "Mobile number", "98XXXXXXXX", "tel")}
              {field("email", "Email (optional)", "you@example.com", "email")}
              {field("password", "Password", "••••••••", "password")}
              {field("confirmPassword", "Confirm password", "••••••••", "password")}
              <PillButton full size="lg" onClick={submitRegister} disabled={busy}>Send verification code</PillButton>
              <button onClick={() => setMode("welcome")} className="w-full text-center text-sm font-bold" style={{ color: C.primary }}>Back</button>
            </div>
          </>
        )}

        {mode === "otp" && (
          <OtpStep target={form.mobile} devHint={challenge?.devHint} onVerify={verifyCode} onResend={requestCode} onChangeNumber={() => setMode("register")} />
        )}
      </div>
    </div>
  );
}
