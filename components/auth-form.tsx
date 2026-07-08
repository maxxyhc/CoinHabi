"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleDollarSign, Eye, EyeOff, Languages, LockKeyhole, ShieldCheck } from "lucide-react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/theme-toggle";
import { isLocale, localeNames, localeOrder, tx } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Locale } from "@/lib/types";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [locale, setLocale] = useState<Locale>("zh");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isNotAllowed = searchParams.get("error") === "not_allowed";
  const confirmationFailed = searchParams.get("error") === "confirmation_failed";

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("locale");
    if (isLocale(storedLocale)) setLocale(storedLocale);
  }, []);

  useEffect(() => {
    if (isNotAllowed) {
      supabase?.auth.signOut();
    }
  }, [isNotAllowed, supabase]);

  function changeLocale(nextLocale: Locale) {
    setLocale(nextLocale);
    window.localStorage.setItem("locale", nextLocale);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageType("error");

    if (!supabase) {
      setMessage(tx(locale, "Supabase environment variables are missing."));
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessage(tx(locale, "Password confirmation does not match."));
      return;
    }

    setLoading(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      setLoading(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data.session) {
        setMessageType("success");
        setMessage(tx(locale, "Registration submitted. Check your email verification link, then return to sign in."));
        setPassword("");
        setConfirmPassword("");
        return;
      }

      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  function changeMode(nextMode: "signin" | "signup") {
    setMode(nextMode);
    setMessage("");
    setMessageType("error");
    setPassword("");
    setConfirmPassword("");
  }

  const heroItems = ["Manual holdings", "Address tracking", "Live prices"];

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="primary-button flex h-11 w-11 items-center justify-center rounded-[16px]">
            <CircleDollarSign size={21} />
          </div>
          <div>
            <p className="font-semibold text-ink">Coinhabi</p>
            <p className="text-xs text-titanium">{tx(locale, "Private portfolio workspace")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="pill-panel focus-within:ring-2 focus-within:ring-[var(--accent)]/35 relative flex h-11 min-w-[118px] cursor-pointer items-center justify-center gap-2 rounded-full px-4">
            <Languages aria-hidden="true" className="shrink-0 text-[var(--accent)]" size={19} />
            <span className="text-sm font-semibold text-ink">{localeNames[locale]}</span>
            <select
              aria-label={tx(locale, "Language")}
              title={localeNames[locale]}
              className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
              value={locale}
              onChange={(event) => changeLocale(event.target.value as Locale)}
            >
              {localeOrder.map((item) => <option key={item} value={item}>{localeNames[item]}</option>)}
            </select>
          </label>
          <ThemeToggle compact locale={locale} />
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-6xl items-center gap-12 py-10 lg:grid-cols-[1fr_440px]">
        <div className="hidden max-w-xl lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-2 text-sm text-titanium shadow-sm">
            <ShieldCheck className="text-mint" size={17} />
            {tx(locale, "Watch-only wallet tracking")}
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-ink xl:text-6xl">
            {tx(locale, "All assets, clearly together.")}
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-titanium">
            {tx(locale, "Track US stocks, Taiwan stocks, crypto, and public wallet addresses in one consistent workspace.")}
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {heroItems.map((item, index) => (
              <div key={item} className="subtle-panel apple-card-sm p-4">
                <p className="text-xs text-titanium">0{index + 1}</p>
                <p className="mt-5 text-sm font-medium text-ink">{tx(locale, item)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="glass-panel apple-card p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div className="accent-mark flex h-11 w-11 items-center justify-center rounded-[16px]">
              <LockKeyhole size={20} />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>{tx(locale, "Private account")}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-ink">
                {tx(locale, mode === "signin" ? "Welcome back" : "Create your account")}
              </h2>
              <p className="mt-2 text-sm leading-6 text-titanium">
                {tx(locale, mode === "signin"
                  ? "Sign in to view portfolio holdings and wallet sync status."
                  : "Create a separate account with email. Your data stays separated from other users.")}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-[var(--surface-muted)] p-1">
              {(["signin", "signup"] as const).map((item) => (
                <button
                  aria-pressed={mode === item}
                  className={clsx(
                    "focus-ring min-h-11 rounded-xl text-sm font-semibold transition",
                    mode === item ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm" : "text-titanium",
                  )}
                  key={item}
                  onClick={() => changeMode(item)}
                  type="button"
                >
                  {tx(locale, item === "signin" ? "Sign in" : "Create account")}
                </button>
              ))}
            </div>

            {(message || isNotAllowed || confirmationFailed) && (
              <div
                role={messageType === "error" || isNotAllowed || confirmationFailed ? "alert" : "status"}
                className={clsx(
                  "apple-card-sm border p-4 text-sm",
                  messageType === "success" && !isNotAllowed && !confirmationFailed
                    ? "border-mint/30 bg-mint/10 text-mint"
                    : "border-rose/30 bg-rose/10 text-rose",
                )}
              >
                {isNotAllowed
                  ? tx(locale, "This email is not allowed yet.")
                  : confirmationFailed
                    ? tx(locale, "Email verification link is invalid or expired. Please sign up again.")
                    : message}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-ink">{tx(locale, "Email")}</span>
              <input
                className="input-control focus-ring mt-2 w-full px-4 text-ink"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-ink">{tx(locale, "Password")}</span>
              <span className="relative mt-2 block">
                <input
                  className="input-control focus-ring w-full px-4 pr-12 text-ink"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button
                  aria-label={tx(locale, showPassword ? "Hide password" : "Show password")}
                  className="focus-ring absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full text-titanium hover:text-ink"
                  onClick={() => setShowPassword((current) => !current)}
                  type="button"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="text-sm font-medium text-ink">{tx(locale, "Confirm password")}</span>
                <input
                  className="input-control focus-ring mt-2 w-full px-4 text-ink"
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                  autoComplete="new-password"
                />
              </label>
            )}

            <button
              className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium transition disabled:opacity-60"
              disabled={loading}
              type="submit"
            >
              {tx(locale, loading
                ? mode === "signin" ? "Signing in..." : "Creating..."
                : mode === "signin" ? "Sign in" : "Create account")}
              <ArrowRight size={18} />
            </button>
            {mode === "signup" && (
              <p className="text-xs leading-5 text-titanium">
                {tx(locale, "If this site uses a private allowlist, an admin still needs to authorize your email after verification.")}
              </p>
            )}
            <div className="border-t border-line pt-5">
              <div className="flex gap-3 text-xs leading-5 text-titanium">
                <ShieldCheck className="mt-0.5 shrink-0 text-mint" size={17} />
                <p>{tx(locale, "Address tracking uses public addresses only. Never enter a seed phrase, private key, or PIN anywhere.")}</p>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
