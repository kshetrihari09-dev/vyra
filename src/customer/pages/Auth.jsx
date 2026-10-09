import React, { useState } from "react";
import { useApp, useC } from "../../store/AppContext.jsx";
import { Logo } from "../layout/CustomerLayout.jsx";
import { PillButton, InlineNotice } from "../../components/shared/ui.jsx";
import { ProductArt } from "../../components/shared/ProductArt.jsx";
import HeroArt from "../components/HeroArt.jsx";
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
    // No nav() here: the signed-in session makes the shell (App.jsx) resolve the one post-login destination — the deep link the user was
    // heading to, else their workspace — so there is a single decision and no stop at the storefront first.
  };

  const submitLogin = async () => {
    if (!isNepalMobile(form.mobile) && !isEmail(form.email)) { setErrors({ mobile: "Enter a valid mobile number or email" }); return; }
    if (!form.password) { setErrors({ password: "Enter your password" }); return; }
    setErrors({});
    setBusy(true);
    try {
      await auth.login({ identifier: isNepalMobile(form.mobile) ? form.mobile : form.email.trim(), password: form.password });
      toast("Welcome back"); // the shell takes it from here (see verifyCode)
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
      <div className={mode === "welcome" ? "w-full max-w-md md:max-w-5xl mx-auto" : "w-full max-w-md mx-auto"}>
        <div className={mode === "welcome" ? "flex justify-center md:justify-start mb-8" : "flex justify-center mb-8"}><Logo size="lg" /></div>

        {mode === "welcome" && (
          <div className="grid gap-7 md:grid-cols-2 md:gap-x-16 md:gap-y-8">
            {/* Headline + promise */}
            <div className="md:col-start-1 md:row-start-1 md:self-end">
              <h1 className="font-extrabold text-[2.6rem] leading-[1.04] tracking-tight md:text-6xl md:leading-[1.02]" style={{ color: C.navy }}>
                Made for Everyday Living.
              </h1>
              <p className="text-base md:text-lg leading-relaxed mt-4 max-w-md" style={{ color: C.navy, opacity: 0.78 }}>
                Everything you need for your everyday life, all in one place.
              </p>
            </div>

            {/* The everyday shelf: a staggered still life of real catalogue items. Decorative; the names are visible text. */}
            <Shelf C={C} items={hero} className="md:col-start-2 md:row-start-1 md:row-span-3 md:self-center" />

            {/* Actions — unchanged behaviour */}
            <div className="md:col-start-1 md:row-start-2 md:max-w-sm">
              <PillButton full size="lg" onClick={() => setMode("login")}>Log in <ArrowRight size={16} /></PillButton>
              <button onClick={() => { setForm({ name: "", mobile: "", email: "", password: "", confirmPassword: "" }); setErrors({}); setMode("register"); }}
                className="w-full rounded-full mt-3 py-3.5 text-sm font-bold flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: C.mint, color: C.primary }}>
                <User size={16} /> Register as Customer
              </button>
              <button onClick={() => nav("shopOnboarding")}
                className="w-full rounded-full mt-3 py-3.5 text-sm font-bold flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ background: C.white, border: `1.5px solid ${C.border}`, color: C.navy }}>
                <Store size={16} /> Register Your Shop
              </button>
              <button onClick={() => nav("home")} className="w-full text-center text-sm mt-4 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" style={{ color: C.navy, opacity: 0.7 }}>Continue as guest</button>
            </div>

            {/* Reassurance, after the actions */}
            <ul className="space-y-2.5 md:col-start-1 md:row-start-3 md:self-start">
              {[
                { icon: Clock, text: "Express delivery in as little as 18 minutes" },
                { icon: ShieldCheck, text: "Licensed pharmacy with prescription verification" },
                { icon: Truck, text: "Free delivery on orders over Rs. 25" },
              ].map((f) => (
                <li key={f.text} className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.mint }}>
                    <f.icon size={15} style={{ color: C.primary }} />
                  </span>
                  <span className="text-sm" style={{ color: C.navy }}>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>
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

/* Four tiles in two offset columns on a brand panel. Heights and corner radii differ on purpose so it reads as objects on a
   shelf rather than a uniform grid. Falls back to the built-in illustrations if the catalogue hasn't loaded these items. */
function Shelf({ C, items, className = "" }) {
  const tiles = items.slice(0, 4);
  const layout = [
    { col: 0, tall: true, r: "rounded-[28px]" },
    { col: 1, tall: false, r: "rounded-3xl" },
    { col: 0, tall: false, r: "rounded-2xl" },
    { col: 1, tall: true, r: "rounded-[28px]" },
  ];
  return (
    <div className={`rounded-[32px] p-3.5 md:p-6 ${className}`} style={{ background: C.primary }}>
      {tiles.length < 2 ? (
        <HeroArt />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:gap-4">
          {[0, 1].map((col) => (
            <div key={col} className={`flex flex-col gap-3 md:gap-4 ${col === 1 ? "pt-5 md:pt-9" : ""}`}>
              {tiles.map((p, i) => ({ p, i, ...layout[i] })).filter((t) => t.col === col).map(({ p, i, tall, r }) => (
                <div key={p.id} className={`vyra-settle ${r} relative overflow-hidden flex items-center justify-center ${tall ? "h-32 md:h-48" : "h-24 md:h-36"}`}
                  style={{ background: i % 2 ? C.mint : C.white, "--d": `${i * 90 + 80}ms` }}>
                  <ProductArt product={p} size={tall ? 84 : 62} rounded={false} />
                  <span className="absolute left-3 bottom-2 right-3 text-[11px] md:text-xs font-semibold truncate" style={{ color: C.navy }}>{p.name}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
