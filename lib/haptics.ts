import { Capacitor } from "@capacitor/core";

/**
 * Thin, safe wrapper around @capacitor/haptics. Every call is a no-op on the
 * web / during SSR (only fires inside the native app). The plugin is imported
 * dynamically so the native module never loads in a browser bundle.
 */

function isNative() {
  return typeof window !== "undefined" && Capacitor.isNativePlatform();
}

async function withHaptics<T>(run: (h: typeof import("@capacitor/haptics")) => Promise<T> | T) {
  if (!isNative()) return;
  try {
    const mod = await import("@capacitor/haptics");
    await run(mod);
  } catch {
    // Haptics are a nice-to-have; never let them break a user action.
  }
}

export function tapLight() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }));
}

export function tapMedium() {
  return withHaptics(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Medium }));
}

export function hapticSuccess() {
  return withHaptics(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Success }));
}

export function hapticError() {
  return withHaptics(({ Haptics, NotificationType }) => Haptics.notification({ type: NotificationType.Error }));
}
