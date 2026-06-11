"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

export function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const isNotAllowed = searchParams.get("error") === "not_allowed";

  useEffect(() => {
    if (isNotAllowed) {
      supabase?.auth.signOut();
    }
  }, [isNotAllowed, supabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!supabase) {
      setMessage("Supabase environment variables are missing.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8 sm:px-8 sm:py-12">
      <section className="glass-panel grid w-full max-w-5xl grid-cols-1 overflow-hidden rounded-lg lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex min-h-[560px] flex-col justify-between border-b border-line p-7 sm:p-10 lg:min-h-[620px] lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-graphite">
              <LockKeyhole size={20} />
            </div>
            <div>
              <p className="text-sm uppercase text-titanium">Financial Tracker</p>
              <h1 className="text-3xl font-semibold text-ink">Private portfolio access</h1>
            </div>
          </div>

          <div className="max-w-md">
            <p className="text-4xl font-semibold leading-tight text-ink sm:text-6xl">Your portfolio, in one view.</p>
            <p className="mt-6 text-lg leading-8 text-titanium">
              Sign in to access your private financial dashboard.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-sm text-titanium">
            <div className="border-t border-line pt-4">US Equities</div>
            <div className="border-t border-line pt-4">Taiwan Equities</div>
            <div className="border-t border-line pt-4">Digital Assets</div>
          </div>
        </div>

        <div className="flex items-center p-7 sm:p-10">
          <form onSubmit={handleSubmit} className="w-full space-y-6">
            <div>
              <p className="text-sm text-titanium">Welcome back</p>
              <h2 className="mt-2 text-4xl font-semibold text-ink">Sign in</h2>
            </div>

            {(message || isNotAllowed) && (
              <div className="rounded-lg border border-rose/40 bg-rose/10 p-4 text-sm text-rose">
                {isNotAllowed ? "This email is not allowed for this app." : message}
              </div>
            )}

            <label className="block">
              <span className="text-sm text-titanium">Email</span>
              <input
                className="focus-ring mt-2 w-full rounded-lg border border-line bg-white/5 px-4 py-3 text-ink"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="text-sm text-titanium">Password</span>
              <input
                className="focus-ring mt-2 w-full rounded-lg border border-line bg-white/5 px-4 py-3 text-ink"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
              />
            </label>

            <button
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 py-3 font-medium text-graphite transition hover:bg-white"
              disabled={loading}
              type="submit"
            >
              {loading ? "Working..." : "Sign in"}
              <ArrowRight size={18} />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
