"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, LockKeyhole } from "lucide-react";
import clsx from "clsx";
import { isLocale, tx } from "@/lib/i18n";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Locale } from "@/lib/types";

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [locale, setLocale] = useState<Locale>("zh");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const storedLocale = window.localStorage.getItem("locale");
    if (isLocale(storedLocale)) setLocale(storedLocale);
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageType("error");

    if (!supabase) {
      setMessage(tx(locale, "Supabase environment variables are missing."));
      return;
    }

    if (password !== confirmPassword) {
      setMessage(tx(locale, "Password confirmation does not match."));
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(error.message.includes("session")
        ? tx(locale, "This reset link is invalid or expired. Request a new one from the sign-in page.")
        : error.message);
      return;
    }

    setMessageType("success");
    setMessage(tx(locale, "Password updated. Signing you in..."));
    window.setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1200);
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-[max(1.25rem,env(safe-area-inset-top))]">
      <div className="glass-panel apple-card w-full max-w-md p-6 sm:p-8">
        <form className="w-full space-y-6" onSubmit={handleSubmit}>
          <div className="accent-mark flex h-11 w-11 items-center justify-center rounded-[16px]">
            <LockKeyhole size={20} />
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>Coinhabi</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-ink">{tx(locale, "Set a new password")}</h1>
          </div>

          {message && (
            <div
              className={clsx(
                "apple-card-sm border p-4 text-sm",
                messageType === "success" ? "border-mint/30 bg-mint/10 text-mint" : "border-rose/30 bg-rose/10 text-rose",
              )}
              role={messageType === "error" ? "alert" : "status"}
            >
              {message}
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-ink">{tx(locale, "New password")}</span>
            <span className="relative mt-2 block">
              <input
                autoComplete="new-password"
                className="input-control focus-ring w-full px-4 pr-12 text-ink"
                minLength={6}
                required
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
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

          <label className="block">
            <span className="text-sm font-medium text-ink">{tx(locale, "Confirm password")}</span>
            <input
              autoComplete="new-password"
              className="input-control focus-ring mt-2 w-full px-4 text-ink"
              minLength={6}
              required
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </label>

          <button
            className="primary-button focus-ring flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-4 font-medium transition disabled:opacity-60"
            disabled={loading}
            type="submit"
          >
            {tx(locale, loading ? "Updating..." : "Update password")}
            <ArrowRight size={18} />
          </button>
        </form>
      </div>
    </main>
  );
}
