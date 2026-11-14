import { useState } from "react";
import { ArrowRightIcon, EyeIcon, EyeSlashIcon, ExclamationCircleIcon, LockClosedIcon } from "@heroicons/react/24/outline";
import { getApiError, loginAccount, registerAccount } from "../api/authApi";
import { useAuth } from "../AuthContext";

const emailPattern = /^\S+@\S+\.\S+$/;

function BrandMark() { return <span className="auth-brand-mark" aria-hidden="true"><i /><i /><i /></span>; }

function DocumentIndexMotif() {
  return <div className="document-motif" aria-hidden="true">
    <div className="motif-axis"><span>01</span><span>02</span><span>03</span></div>
    <div className="motif-sheet">
      <div className="motif-sheet-head"><span>DOCUMENT INDEX</span><span>REV. 04</span></div><div className="motif-rule motif-rule-long" />
      <div className="motif-row"><b>01</b><span>Process safety manual</span><em>184 p.</em></div><div className="motif-row"><b>02</b><span>Equipment specifications</span><em>96 p.</em></div><div className="motif-row"><b>03</b><span>Maintenance procedure</span><em>42 p.</em></div>
      <div className="motif-rule" /><div className="motif-drawing"><span /><span /><span /></div>
    </div>
  </div>;
}

export default function AuthPage({ mode = "login", onNavigate }) {
  const { login } = useAuth();
  const isRegister = mode === "register";
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const updateField = (field, value) => { setForm((current) => ({ ...current, [field]: value })); setErrors((current) => ({ ...current, [field]: "" })); setServerError(""); };
  const submit = async (event) => {
    event.preventDefault(); if (isSubmitting) return; const nextErrors = {};
    if (!emailPattern.test(form.email.trim())) nextErrors.email = "Enter a valid email address.";
    if (!form.password) nextErrors.password = "Enter your password.";
    if (isRegister && (form.password.length < 12 || form.password.length > 128 || !/[a-z]/.test(form.password) || !/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password))) nextErrors.password = "Use 12–128 characters with upper-case, lower-case, number, and symbol characters.";
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setIsSubmitting(true);
    try {
      const sessionUser = isRegister
        ? await registerAccount(form.email.trim(), form.password)
        : await loginAccount(form.email.trim(), form.password);
      login(sessionUser);
      onNavigate?.("/");
    } catch (error) { setServerError(getApiError(error, "We could not complete that request. Please try again.")); }
    finally { setIsSubmitting(false); }
  };
  const switchMode = (nextMode) => { setErrors({}); setServerError(""); onNavigate?.(`/${nextMode}`); };
  return <main className="auth-shell">
    <section className="auth-story" aria-label="Industrial Knowledge Intelligence"><div className="auth-story-content">
      <div className="auth-brand"><BrandMark /><span>Industrial Knowledge <b>Intelligence</b></span></div>
      <div className="auth-intro"><p className="auth-eyebrow">Knowledge workspace / 01</p><h1>Your technical knowledge, <em>within reach.</em></h1><p>Search the manuals, specifications and operating procedures your team relies on—then trace every answer back to its source.</p><div className="auth-statement"><span /><span>Built for precise, source-aware knowledge.</span></div></div>
      <DocumentIndexMotif /><p className="auth-footer-note">Industrial Knowledge Intelligence · Document-grounded answers</p>
    </div></section>
    <section className="auth-panel" aria-labelledby="auth-heading">
      <div className="auth-mobile-brand"><BrandMark /><span>Industrial Knowledge <b>Intelligence</b></span></div>
      <div className="auth-card"><div className="auth-card-heading"><p className="auth-overline">{isRegister ? "Knowledge workspace" : "Welcome back"}</p><h1 id="auth-heading">{isRegister ? "Create your account" : "Welcome back"}</h1><p>{isRegister ? "Create an account to begin building your knowledge workspace." : "Sign in to continue to your knowledge workspace."}</p></div>
        <form className="auth-form" onSubmit={submit} noValidate>
          <label htmlFor="auth-email">{isRegister ? "Work email" : "Email"}<input id="auth-email" name="email" autoComplete="email" inputMode="email" type="email" value={form.email} onChange={(event) => updateField("email", event.target.value)} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? "email-error" : undefined} placeholder="you@company.com" />{errors.email && <span className="field-error" id="email-error"><ExclamationCircleIcon />{errors.email}</span>}</label>
          <label htmlFor="auth-password">Password<span className="password-field"><input id="auth-password" name="password" autoComplete={isRegister ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} value={form.password} onChange={(event) => updateField("password", event.target.value)} aria-invalid={Boolean(errors.password)} aria-describedby={errors.password ? "password-error" : isRegister ? "password-guidance" : undefined} placeholder={isRegister ? "Choose a password" : "Enter your password"} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeSlashIcon /> : <EyeIcon />}</button></span>{errors.password && <span className="field-error" id="password-error"><ExclamationCircleIcon />{errors.password}</span>}{isRegister && <span className="field-guidance" id="password-guidance">12–128 characters with upper-case, lower-case, number, and symbol characters.</span>}</label>
          {serverError && <p className="auth-error" role="alert"><ExclamationCircleIcon />{serverError}</p>}<button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? "Please wait…" : isRegister ? "Create account" : "Sign in"}<ArrowRightIcon /></button>
        </form>
        <p className="auth-switch">{isRegister ? "Already have an account?" : "New to Industrial Knowledge Intelligence?"} <button type="button" onClick={() => switchMode(isRegister ? "login" : "register")}>{isRegister ? "Sign in" : "Create an account"}</button></p><p className="auth-security"><LockClosedIcon /> Protected with a secure, HTTP-only session.</p>
      </div>
    </section>
  </main>;
}
