"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, CircleDollarSign, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { ThemeToggle } from "@/components/theme-toggle";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
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
    if (isNotAllowed) {
      supabase?.auth.signOut();
    }
  }, [isNotAllowed, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setMessageType("error");

    if (!supabase) {
      setMessage("Supabase environment variables are missing.");
      return;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setMessage("兩次輸入的密碼不一致。");
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
        setMessage("註冊申請已送出。請到信箱點擊驗證連結，再回來登入。");
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

  return (
    <main className="min-h-screen px-4 py-5 sm:px-8 sm:py-8">
      <header className="mx-auto flex max-w-6xl items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="primary-button flex h-11 w-11 items-center justify-center rounded-[16px]">
            <CircleDollarSign size={21} />
          </div>
          <div>
            <p className="font-semibold text-ink">Financial Tracker</p>
            <p className="text-xs text-titanium">Private portfolio workspace</p>
          </div>
        </div>
        <ThemeToggle compact />
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-96px)] max-w-6xl items-center gap-12 py-10 lg:grid-cols-[1fr_440px]">
        <div className="hidden max-w-xl lg:block">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-line bg-panel/80 px-3 py-2 text-sm text-titanium shadow-sm">
            <ShieldCheck className="text-mint" size={17} />
            Watch-only wallet tracking
          </div>
          <h1 className="text-5xl font-semibold leading-[1.05] tracking-[-0.055em] text-ink xl:text-6xl">
            所有資產，<br />清楚放在一起。
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-8 text-titanium">
            整合美股、台股、加密貨幣與公開錢包地址，以一致的方式查看市值、來源與風險。
          </p>
          <div className="mt-10 grid grid-cols-3 gap-3">
            {["手動持倉", "地址追蹤", "即時價格"].map((item, index) => (
              <div key={item} className="subtle-panel apple-card-sm p-4">
                <p className="text-xs text-titanium">0{index + 1}</p>
                <p className="mt-5 text-sm font-medium text-ink">{item}</p>
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
              <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>私人帳戶</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.025em] text-ink">
                {mode === "signin" ? "歡迎回來" : "建立你的帳號"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-titanium">
                {mode === "signin"
                  ? "登入以查看你的投資組合與錢包同步狀態。"
                  : "使用 Email 建立獨立帳號，你的資料會與其他使用者分開。"}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-line bg-[var(--surface-muted)] p-1">
              <button
                aria-pressed={mode === "signin"}
                className={`focus-ring min-h-11 rounded-xl text-sm font-semibold transition ${
                  mode === "signin"
                    ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm"
                    : "text-titanium"
                }`}
                onClick={() => changeMode("signin")}
                type="button"
              >
                登入
              </button>
              <button
                aria-pressed={mode === "signup"}
                className={`focus-ring min-h-11 rounded-xl text-sm font-semibold transition ${
                  mode === "signup"
                    ? "bg-[var(--surface-raised)] text-[var(--accent)] shadow-sm"
                    : "text-titanium"
                }`}
                onClick={() => changeMode("signup")}
                type="button"
              >
                建立帳號
              </button>
            </div>

            {(message || isNotAllowed || confirmationFailed) && (
              <div
                role={messageType === "error" || isNotAllowed || confirmationFailed ? "alert" : "status"}
                className={`apple-card-sm border p-4 text-sm ${
                  messageType === "success" && !isNotAllowed && !confirmationFailed
                    ? "border-mint/30 bg-mint/10 text-mint"
                    : "border-rose/30 bg-rose/10 text-rose"
                }`}
              >
                {isNotAllowed
                  ? "這個 Email 尚未獲得使用權限。"
                  : confirmationFailed
                    ? "Email 驗證連結無效或已過期，請重新註冊。"
                    : message}
              </div>
            )}

            <label className="block">
              <span className="text-sm font-medium text-ink">Email</span>
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
              <span className="text-sm font-medium text-ink">密碼</span>
              <span className="relative mt-2 block">
                <input
                  className="input-control focus-ring w-full px-4 pr-12 text-ink"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                />
                <button aria-label={showPassword ? "隱藏密碼" : "顯示密碼"} className="focus-ring absolute right-1 top-1 flex h-10 w-10 items-center justify-center rounded-full text-titanium hover:text-ink" onClick={() => setShowPassword((current) => !current)} type="button">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            {mode === "signup" && (
              <label className="block">
                <span className="text-sm font-medium text-ink">確認密碼</span>
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
              {loading
                ? mode === "signin" ? "登入中..." : "建立中..."
                : mode === "signin" ? "登入" : "建立帳號"}
              <ArrowRight size={18} />
            </button>
            {mode === "signup" && (
              <p className="text-xs leading-5 text-titanium">
                若此網站啟用了私人白名單，完成 Email 驗證後仍需由管理員加入使用權限。
              </p>
            )}
            <div className="border-t border-line pt-5">
              <div className="flex gap-3 text-xs leading-5 text-titanium">
                <ShieldCheck className="mt-0.5 shrink-0 text-mint" size={17} />
                <p>地址追蹤只使用 public address。請勿在任何地方輸入助記詞、private key 或 PIN。</p>
              </div>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
