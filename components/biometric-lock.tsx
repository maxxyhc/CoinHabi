"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ScanFace } from "lucide-react";
import { authenticate, isNativePlatform } from "@/lib/biometric";
import { tx } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

/**
 * Wraps the authenticated app. When the biometric lock is enabled on a native
 * device, it hides the content behind a full-screen gate and requires Face ID /
 * Touch ID on launch and every time the app returns to the foreground. On the
 * web (non-native) or in demo mode it renders children untouched.
 */
export function BiometricLock({
  children,
  demo,
  enabled,
  locale,
}: {
  children: ReactNode;
  demo: boolean;
  enabled: boolean;
  locale: Locale;
}) {
  const active = enabled && !demo && isNativePlatform();
  const [locked, setLocked] = useState(active);
  const authenticating = useRef(false);

  const reason = tx(locale, "Unlock to view your finances");

  const tryUnlock = useCallback(async () => {
    if (authenticating.current) return;
    authenticating.current = true;
    const ok = await authenticate(reason);
    authenticating.current = false;
    if (ok) setLocked(false);
  }, [reason]);

  useEffect(() => {
    if (!active) {
      setLocked(false);
      return;
    }
    setLocked(true);
    tryUnlock();

    let remove: (() => void) | undefined;
    import("@capacitor/app").then(({ App }) => {
      App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) {
          setLocked(true);
          tryUnlock();
        }
      }).then((handle) => {
        remove = () => handle.remove();
      });
    });
    return () => remove?.();
  }, [active, tryUnlock]);

  if (!active || !locked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-[var(--page)] px-6 text-center">
      <div className="accent-mark flex h-16 w-16 items-center justify-center rounded-[22px]">
        <ScanFace size={30} />
      </div>
      <div>
        <p className="text-xl font-semibold text-ink">Coinhabi</p>
        <p className="mt-2 text-sm text-titanium">{tx(locale, "Authentication required to continue")}</p>
      </div>
      <button
        className="primary-button focus-ring min-h-12 rounded-full px-6 font-medium"
        onClick={tryUnlock}
        type="button"
      >
        {tx(locale, "Unlock")}
      </button>
    </div>
  );
}
